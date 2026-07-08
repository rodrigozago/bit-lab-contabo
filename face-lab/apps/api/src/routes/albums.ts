import { unlink } from "fs/promises";
import { join } from "path";
import type { FastifyInstance } from "fastify";
import type { AlbumSummary, PhotoItem, ScanStatus } from "@face-lab/shared";
import { pool } from "../db.js";
import { config } from "../config.js";
import { requireProducer } from "../guards.js";
import { getAccessToken } from "../services/googleOAuth.js";
import { parseFolderId, getFolderInfo } from "../services/drive.js";
import { startScan, isScanning } from "../services/scanOrchestrator.js";

async function ownedAlbum(albumId: string, ownerId: string, isAdmin: boolean) {
  const { rows } = await pool.query(
    isAdmin ? `SELECT * FROM albums WHERE id = $1` : `SELECT * FROM albums WHERE id = $1 AND owner_id = $2`,
    isAdmin ? [albumId] : [albumId, ownerId]
  );
  return rows[0] ?? null;
}

const ALBUM_SUMMARY_SQL = `
  SELECT a.id, a.name, a.status, a.error, a.drive_folder_id, a.scanned_at, a.created_at,
         COUNT(p.id)::int AS photo_count,
         COUNT(p.id) FILTER (WHERE p.status = 'done')::int AS done_count,
         COALESCE(SUM(fc.n), 0)::int AS face_count,
         (SELECT COUNT(*)::int FROM people pe WHERE pe.album_id = a.id) AS people_count
  FROM albums a
  LEFT JOIN photos p ON p.album_id = a.id
  LEFT JOIN LATERAL (SELECT COUNT(*)::int AS n FROM faces f WHERE f.photo_id = p.id) fc ON true
`;

function toAlbumSummary(row: Record<string, unknown>): AlbumSummary {
  return {
    id: String(row["id"]),
    name: String(row["name"]),
    status: row["status"] as AlbumSummary["status"],
    error: (row["error"] as string | null) ?? null,
    driveFolderId: String(row["drive_folder_id"]),
    photoCount: Number(row["photo_count"]),
    doneCount: Number(row["done_count"]),
    faceCount: Number(row["face_count"]),
    peopleCount: Number(row["people_count"]),
    scannedAt: row["scanned_at"] ? new Date(row["scanned_at"] as string).toISOString() : null,
    createdAt: new Date(row["created_at"] as string).toISOString(),
  };
}

export async function albumRoutes(app: FastifyInstance): Promise<void> {
  app.post("/api/albums", async (req, reply) => {
    const user = await requireProducer(req, reply);
    if (!user) return;

    const { name, driveFolderUrl } = (req.body ?? {}) as { name?: string; driveFolderUrl?: string };
    if (!name?.trim()) return reply.status(400).send({ ok: false, error: "name é obrigatório" });
    const folderId = parseFolderId(driveFolderUrl ?? "");
    if (!folderId) return reply.status(400).send({ ok: false, error: "link de pasta do Drive inválido" });

    // valida a pasta com o token do producer antes de criar
    let accessToken: string;
    try {
      accessToken = await getAccessToken(user.id);
    } catch {
      return reply.status(400).send({ ok: false, error: "conecte sua conta Google antes de criar um álbum" });
    }
    const info = await getFolderInfo(accessToken, folderId);

    const { rows } = await pool.query(
      `INSERT INTO albums (owner_id, name, drive_folder_id) VALUES ($1, $2, $3) RETURNING id`,
      [user.id, name.trim(), folderId]
    );

    return {
      ok: true,
      data: {
        id: rows[0].id,
        folderName: info.name,
        // sem link-share os guests não conseguem baixar do Drive — só avisamos, não bloqueia
        linkSharedWarning: info.linkShared
          ? null
          : 'A pasta não está compartilhada como "qualquer pessoa com o link" — os downloads do Drive não vão funcionar pros convidados.',
      },
    };
  });

  app.get("/api/albums", async (req, reply) => {
    const user = await requireProducer(req, reply);
    if (!user) return;
    const { rows } = await pool.query(
      `${ALBUM_SUMMARY_SQL} WHERE a.owner_id = $1 GROUP BY a.id ORDER BY a.created_at DESC`,
      [user.id]
    );
    return { ok: true, data: rows.map(toAlbumSummary) };
  });

  app.get("/api/albums/:id", async (req, reply) => {
    const user = await requireProducer(req, reply);
    if (!user) return;
    const { id } = req.params as { id: string };
    const album = await ownedAlbum(id, user.id, user.role === "admin");
    if (!album) return reply.status(404).send({ ok: false, error: "álbum não encontrado" });
    const { rows } = await pool.query(`${ALBUM_SUMMARY_SQL} WHERE a.id = $1 GROUP BY a.id`, [id]);
    return { ok: true, data: toAlbumSummary(rows[0]) };
  });

  app.patch("/api/albums/:id", async (req, reply) => {
    const user = await requireProducer(req, reply);
    if (!user) return;
    const { id } = req.params as { id: string };
    const { name } = (req.body ?? {}) as { name?: string };
    if (!name?.trim()) return reply.status(400).send({ ok: false, error: "name é obrigatório" });
    const album = await ownedAlbum(id, user.id, user.role === "admin");
    if (!album) return reply.status(404).send({ ok: false, error: "álbum não encontrado" });
    await pool.query(`UPDATE albums SET name = $2 WHERE id = $1`, [id, name.trim()]);
    return { ok: true, data: null };
  });

  app.delete("/api/albums/:id", async (req, reply) => {
    const user = await requireProducer(req, reply);
    if (!user) return;
    const { id } = req.params as { id: string };
    const album = await ownedAlbum(id, user.id, user.role === "admin");
    if (!album) return reply.status(404).send({ ok: false, error: "álbum não encontrado" });

    // higiene biométrica: apaga thumbs e crops do disco antes do CASCADE do banco
    const media = await pool.query(
      `SELECT p.thumb_path, f.crop_path FROM photos p LEFT JOIN faces f ON f.photo_id = p.id WHERE p.album_id = $1`,
      [id]
    );
    for (const row of media.rows) {
      if (row.thumb_path) await unlink(join(config.mediaDir, row.thumb_path)).catch(() => {});
      if (row.crop_path) await unlink(join(config.mediaDir, row.crop_path)).catch(() => {});
    }
    await pool.query(`DELETE FROM albums WHERE id = $1`, [id]);
    return { ok: true, data: null };
  });

  app.post("/api/albums/:id/scan", async (req, reply) => {
    const user = await requireProducer(req, reply);
    if (!user) return;
    const { id } = req.params as { id: string };
    const album = await ownedAlbum(id, user.id, user.role === "admin");
    if (!album) return reply.status(404).send({ ok: false, error: "álbum não encontrado" });
    if (isScanning(id)) return { ok: true, data: { started: false, reason: "scan já em andamento" } };
    startScan(id, album.owner_id);
    return { ok: true, data: { started: true } };
  });

  app.get("/api/albums/:id/scan-status", async (req, reply) => {
    const user = await requireProducer(req, reply);
    if (!user) return;
    const { id } = req.params as { id: string };
    const album = await ownedAlbum(id, user.id, user.role === "admin");
    if (!album) return reply.status(404).send({ ok: false, error: "álbum não encontrado" });

    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE status = 'done')::int AS done,
              COUNT(*) FILTER (WHERE status = 'error')::int AS errors,
              COUNT(*) FILTER (WHERE status IN ('pending', 'processing'))::int AS pending
       FROM photos WHERE album_id = $1`,
      [id]
    );
    const s = rows[0];
    const status: ScanStatus = {
      album: album.status,
      total: s.total,
      done: s.done,
      errors: s.errors,
      pending: s.pending,
    };
    return { ok: true, data: status };
  });

  // pessoas do álbum (clusters) — capa + contagens, pra faixa de filtro na UI
  app.get("/api/albums/:id/people", async (req, reply) => {
    const user = await requireProducer(req, reply);
    if (!user) return;
    const { id } = req.params as { id: string };
    const album = await ownedAlbum(id, user.id, user.role === "admin");
    if (!album) return reply.status(404).send({ ok: false, error: "álbum não encontrado" });

    const { rows } = await pool.query(
      `SELECT pe.id, pe.face_count, pe.cover_face_id,
              (SELECT COUNT(DISTINCT f.photo_id)::int FROM faces f WHERE f.person_id = pe.id) AS photo_count
       FROM people pe WHERE pe.album_id = $1 ORDER BY pe.face_count DESC`,
      [id]
    );
    return {
      ok: true,
      data: rows.map((r) => ({
        id: r.id,
        faceCount: r.face_count,
        photoCount: r.photo_count,
        coverCropUrl: r.cover_face_id ? `/api/media/crops/${r.cover_face_id}.webp` : null,
      })),
    };
  });

  app.get("/api/albums/:id/photos", async (req, reply) => {
    const user = await requireProducer(req, reply);
    if (!user) return;
    const { id } = req.params as { id: string };
    const { personId } = req.query as { personId?: string };
    const album = await ownedAlbum(id, user.id, user.role === "admin");
    if (!album) return reply.status(404).send({ ok: false, error: "álbum não encontrado" });

    const params: unknown[] = [id];
    let personFilter = "";
    if (personId) {
      params.push(personId);
      personFilter = `AND EXISTS (SELECT 1 FROM faces pf WHERE pf.photo_id = p.id AND pf.person_id = $2)`;
    }
    const { rows } = await pool.query(
      `SELECT p.id, p.name, p.status, p.thumb_path, p.web_view_link, p.web_content_link, p.taken_at,
              (SELECT COUNT(*)::int FROM faces f WHERE f.photo_id = p.id) AS face_count
       FROM photos p WHERE p.album_id = $1 ${personFilter} ORDER BY p.taken_at NULLS LAST, p.name`,
      params
    );
    const photos: PhotoItem[] = rows.map((r) => ({
      id: r.id,
      name: r.name,
      status: r.status,
      thumbUrl: r.thumb_path ? `/api/media/thumbs/${r.id}.webp` : null,
      webViewLink: r.web_view_link,
      webContentLink: r.web_content_link,
      faceCount: r.face_count,
      takenAt: r.taken_at ? new Date(r.taken_at).toISOString() : null,
    }));
    return { ok: true, data: photos };
  });
}
