import type { FastifyInstance } from "fastify";
import type { NotificationsResponse } from "@face-lab/shared";
import { pool } from "../db.js";
import { requireUser } from "../guards.js";

export async function notificationRoutes(app: FastifyInstance): Promise<void> {
  // últimas fotos encontradas do usuário + quantas são posteriores ao último "visto"
  app.get("/api/me/notifications", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;

    // total não-lido não tem LIMIT — contaria errado se houvesse mais de 10 desde a última visita
    const { rows: unread } = await pool.query(
      `SELECT COUNT(*)::int AS n FROM matches m
       JOIN users u ON u.id = m.user_id
       WHERE m.user_id = $1 AND m.status <> 'rejected'
         AND m.created_at > COALESCE(u.notifications_seen_at, u.created_at)`,
      [user.id]
    );

    const { rows } = await pool.query(
      `SELECT p.id AS photo_id, a.id AS album_id, a.name AS album_name, p.thumb_path, m.created_at AS matched_at
       FROM matches m
       JOIN faces f ON f.id = m.face_id
       JOIN photos p ON p.id = f.photo_id
       JOIN albums a ON a.id = p.album_id
       WHERE m.user_id = $1 AND m.status <> 'rejected'
       ORDER BY m.created_at DESC
       LIMIT 10`,
      [user.id]
    );

    const data: NotificationsResponse = {
      unreadCount: unread[0].n as number,
      items: rows.map((r) => ({
        photoId: r.photo_id,
        albumId: r.album_id,
        albumName: r.album_name,
        thumbUrl: r.thumb_path ? `/api/media/thumbs/${r.photo_id}.webp` : null,
        matchedAt: new Date(r.matched_at).toISOString(),
      })),
    };
    return { ok: true, data };
  });

  app.post("/api/me/notifications/seen", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    await pool.query(`UPDATE users SET notifications_seen_at = now() WHERE id = $1`, [user.id]);
    return { ok: true, data: null };
  });
}
