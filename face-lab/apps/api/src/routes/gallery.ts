import type { FastifyInstance } from "fastify";
import type { MyAlbum, MyPhoto } from "@face-lab/shared";
import { pool } from "../db.js";
import { requireUser } from "../guards.js";

export async function galleryRoutes(app: FastifyInstance): Promise<void> {
  // álbuns em que o usuário aparece (≥1 match não-rejeitado)
  app.get("/api/my/albums", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    const { rows } = await pool.query(
      `SELECT a.id, a.name, COUNT(DISTINCT p.id)::int AS match_count
       FROM matches m
       JOIN faces f ON f.id = m.face_id
       JOIN photos p ON p.id = f.photo_id
       JOIN albums a ON a.id = p.album_id
       WHERE m.user_id = $1 AND m.status <> 'rejected'
       GROUP BY a.id, a.name
       ORDER BY MAX(p.created_at) DESC`,
      [user.id]
    );
    const albums: MyAlbum[] = rows.map((r) => ({ id: r.id, name: r.name, matchCount: r.match_count }));
    return { ok: true, data: albums };
  });

  app.get("/api/my/albums/:id/photos", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    const { id } = req.params as { id: string };
    const { rows } = await pool.query(
      `SELECT p.id, p.name, p.thumb_path, p.web_view_link, p.web_content_link, p.taken_at,
              (ARRAY_AGG(m.face_id ORDER BY m.distance))[1] AS face_id,
              MIN(m.distance)::real AS distance
       FROM matches m
       JOIN faces f ON f.id = m.face_id
       JOIN photos p ON p.id = f.photo_id
       WHERE m.user_id = $1 AND m.status <> 'rejected' AND p.album_id = $2
       GROUP BY p.id
       ORDER BY p.taken_at NULLS LAST, p.name`,
      [user.id, id]
    );
    const photos: MyPhoto[] = rows.map((r) => ({
      id: r.id,
      name: r.name,
      thumbUrl: r.thumb_path ? `/api/media/thumbs/${r.id}.webp` : null,
      webViewLink: r.web_view_link,
      webContentLink: r.web_content_link,
      faceId: r.face_id,
      distance: r.distance,
      takenAt: r.taken_at ? new Date(r.taken_at).toISOString() : null,
    }));
    return { ok: true, data: photos };
  });

  // "não sou eu" — a foto some da galeria do usuário e o rematch preserva a decisão
  app.post("/api/my/matches/:faceId/reject", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    const { faceId } = req.params as { faceId: string };
    const { rowCount } = await pool.query(
      `UPDATE matches SET status = 'rejected' WHERE face_id = $1 AND user_id = $2`,
      [faceId, user.id]
    );
    if (!rowCount) return reply.status(404).send({ ok: false, error: "match não encontrado" });
    return { ok: true, data: null };
  });
}
