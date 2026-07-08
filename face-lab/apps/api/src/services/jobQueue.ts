import { unlink, rm } from "fs/promises";
import { join } from "path";
import {
  JOBS_QUEUE,
  RESULTS_CHANNEL,
  type WorkerJob,
  type WorkerResult,
  type PhotoFacesResult,
  type EnrollmentResult,
} from "@face-lab/shared";
import { getRedis, newSubscriber } from "../redis.js";
import { pool, toVector } from "../db.js";
import { config } from "../config.js";
import { matchPhotoFaces, matchEnrollment } from "./matching.js";
import { assignPeopleForPhoto } from "./clustering.js";

// Mesmo formato do ponto-studio (RPUSH fila + PUBLISH resultados), mas os
// resultados persistem no Postgres — nada de estado em memória.

export async function enqueue(job: WorkerJob): Promise<void> {
  const redis = await getRedis();
  await redis.rPush(JOBS_QUEUE, JSON.stringify(job));
}

export async function startResultListener(): Promise<void> {
  const sub = await newSubscriber();
  await sub.subscribe(RESULTS_CHANNEL, (message: string) => {
    void handleResult(message).catch((err) => {
      console.error("[jobQueue] falha ao processar resultado:", err);
    });
  });
  console.log(`[jobQueue] ouvindo resultados em ${RESULTS_CHANNEL}`);
}

async function handleResult(message: string): Promise<void> {
  const result = JSON.parse(message) as WorkerResult;
  if (result.type === "photo_faces") return handlePhotoResult(result);
  if (result.type === "enrollment") return handleEnrollmentResult(result);
  console.warn("[jobQueue] resultado de tipo desconhecido:", result);
}

async function handlePhotoResult(result: PhotoFacesResult): Promise<void> {
  const { photoId } = result;

  // o worker apaga o original no finally; unlink extra aqui é só cinto de segurança
  await unlink(join(config.mediaDir, "incoming", `${photoId}.img`)).catch(() => {});

  if (result.status === "error") {
    await pool.query(`UPDATE photos SET status = 'error', error = $2 WHERE id = $1`, [
      photoId,
      result.error ?? "worker falhou",
    ]);
  } else {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `UPDATE photos SET status = 'done', error = NULL, width = $2, height = $3, thumb_path = $4 WHERE id = $1`,
        [photoId, result.width ?? null, result.height ?? null, result.thumbPath ?? null]
      );
      for (const face of result.faces ?? []) {
        await client.query(
          `INSERT INTO faces (photo_id, bbox, det_score, crop_path, embedding)
           VALUES ($1, $2, $3, $4, $5::vector)`,
          [photoId, JSON.stringify(face.bbox), face.detScore, face.cropPath, toVector(face.embedding)]
        );
      }
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }

    // agrupa em pessoas ANTES do match (o filtro "não sou eu" é por pessoa)
    await assignPeopleForPhoto(photoId);
    await matchPhotoFaces(photoId);
  }

  // contabiliza o reconhecimento pro producer dono do álbum (base de planos futuros)
  await pool.query(
    `INSERT INTO usage_events (user_id, type, album_id)
     SELECT a.owner_id, 'photo_processed', a.id FROM photos p JOIN albums a ON a.id = p.album_id WHERE p.id = $1`,
    [photoId]
  );

  await refreshAlbumStatus(photoId);
}

/** Foto acabou → se o álbum não tem mais pendências, vira ready. */
async function refreshAlbumStatus(photoId: string): Promise<void> {
  await pool.query(
    `UPDATE albums a SET status = 'ready', scanned_at = now(), error = NULL
     WHERE a.id = (SELECT album_id FROM photos WHERE id = $1)
       AND a.status = 'scanning'
       AND NOT EXISTS (
         SELECT 1 FROM photos p WHERE p.album_id = a.id AND p.status IN ('pending', 'processing')
       )`,
    [photoId]
  );
}

async function handleEnrollmentResult(result: EnrollmentResult): Promise<void> {
  const { enrollmentId } = result;

  // frames de webcam são dados biométricos temporários — sempre apagar
  await rm(join(config.mediaDir, "enroll", enrollmentId), { recursive: true, force: true }).catch(() => {});

  if (result.status === "error" || !result.embedding) {
    await pool.query(`UPDATE enrollments SET status = 'error', error = $2 WHERE id = $1`, [
      enrollmentId,
      result.error ?? "worker falhou",
    ]);
    return;
  }

  const { rows } = await pool.query(
    `UPDATE enrollments SET status = 'done', error = NULL, embedding = $2::vector, frame_count = $3
     WHERE id = $1 RETURNING user_id`,
    [enrollmentId, toVector(result.embedding), result.frameCount ?? 0]
  );
  const userId = rows[0]?.user_id as string | undefined;
  if (!userId) return;

  const matched = await matchEnrollment(enrollmentId, userId, result.embedding);
  console.log(`[jobQueue] enrollment ${enrollmentId} concluído — ${matched} matches`);

  await pool.query(`INSERT INTO usage_events (user_id, type) VALUES ($1, 'enrollment')`, [userId]);
}
