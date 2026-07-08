import { createReadStream } from "fs";
import { stat } from "fs/promises";
import { join } from "path";
import type { FastifyInstance } from "fastify";
import { pool } from "../db.js";
import { config } from "../config.js";
import { requireUser } from "../guards.js";

// Thumbs/crops são derivados de dados biométricos — nunca públicos.
// thumbs/<photoId>.webp: dono do álbum, admin, ou usuário PARTICIPANTE do álbum
//   (≥1 match não-rejeitado em qualquer foto dali — necessário pro "Todas as
//   fotos" navegar o álbum inteiro, não só as fotos já casadas com ele).
// crops/<faceId>.webp:  dono do álbum, admin ou o próprio usuário casado na face.

const FILE_RE = /^([0-9a-f-]{36})\.webp$/;

export async function mediaRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/media/thumbs/:file", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    const { file } = req.params as { file: string };
    const m = FILE_RE.exec(file);
    if (!m) return reply.status(400).send({ ok: false, error: "nome inválido" });
    const photoId = m[1];

    const { rows } = await pool.query(
      `SELECT p.thumb_path FROM photos p
       JOIN albums a ON a.id = p.album_id
       WHERE p.id = $1 AND (
         $3 OR a.owner_id = $2 OR EXISTS (
           SELECT 1 FROM matches mt JOIN faces f ON f.id = mt.face_id JOIN photos p2 ON p2.id = f.photo_id
           WHERE p2.album_id = p.album_id AND mt.user_id = $2 AND mt.status <> 'rejected'))`,
      [photoId, user.id, user.role === "admin"]
    );
    const thumbPath = rows[0]?.thumb_path as string | undefined;
    if (!thumbPath) return reply.status(404).send({ ok: false, error: "não encontrado" });
    return sendWebp(reply, join(config.mediaDir, thumbPath));
  });

  app.get("/api/media/crops/:file", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    const { file } = req.params as { file: string };
    const m = FILE_RE.exec(file);
    if (!m) return reply.status(400).send({ ok: false, error: "nome inválido" });
    const faceId = m[1];

    const { rows } = await pool.query(
      `SELECT f.crop_path FROM faces f
       JOIN photos p ON p.id = f.photo_id
       JOIN albums a ON a.id = p.album_id
       WHERE f.id = $1 AND (
         $3 OR a.owner_id = $2 OR EXISTS (
           SELECT 1 FROM matches mt WHERE mt.face_id = f.id AND mt.user_id = $2))`,
      [faceId, user.id, user.role === "admin"]
    );
    const cropPath = rows[0]?.crop_path as string | undefined;
    if (!cropPath) return reply.status(404).send({ ok: false, error: "não encontrado" });
    return sendWebp(reply, join(config.mediaDir, cropPath));
  });
}

async function sendWebp(reply: import("fastify").FastifyReply, absPath: string) {
  try {
    await stat(absPath);
  } catch {
    return reply.status(404).send({ ok: false, error: "arquivo não existe" });
  }
  return reply
    .type("image/webp")
    .header("Cache-Control", "private, max-age=86400")
    .send(createReadStream(absPath));
}
