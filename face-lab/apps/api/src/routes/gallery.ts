import type { FastifyInstance } from "fastify";
import type { AllAlbumPhoto, MyAlbum, MyPhoto } from "@face-lab/shared";
import { pool } from "../db.js";
import { requireUser } from "../guards.js";
import { claimFace, confirmAndExpand, rejectPerson } from "../services/matching.js";

/** true se o usuário tem ≥1 match não-rejeitado em qualquer foto deste álbum. */
async function isAlbumParticipant(albumId: string, userId: string): Promise<boolean> {
  const { rows } = await pool.query(
    `SELECT 1 FROM matches m
     JOIN faces f ON f.id = m.face_id
     JOIN photos p ON p.id = f.photo_id
     WHERE p.album_id = $1 AND m.user_id = $2 AND m.status <> 'rejected'
     LIMIT 1`,
    [albumId, userId]
  );
  return rows.length > 0;
}

export async function galleryRoutes(app: FastifyInstance): Promise<void> {
  // álbuns em que o usuário aparece (≥1 match não-rejeitado)
  app.get("/api/my/albums", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    const { rows } = await pool.query(
      `SELECT a.id, a.name, COUNT(DISTINCT p.id)::int AS match_count,
              (ARRAY_AGG(p.id ORDER BY p.taken_at DESC NULLS LAST)
                 FILTER (WHERE p.thumb_path IS NOT NULL))[1] AS cover_photo_id
       FROM matches m
       JOIN faces f ON f.id = m.face_id
       JOIN photos p ON p.id = f.photo_id
       JOIN albums a ON a.id = p.album_id
       WHERE m.user_id = $1 AND m.status <> 'rejected'
       GROUP BY a.id, a.name
       ORDER BY MAX(p.created_at) DESC`,
      [user.id]
    );
    const albums: MyAlbum[] = rows.map((r) => ({
      id: r.id,
      name: r.name,
      matchCount: r.match_count,
      coverUrl: r.cover_photo_id ? `/api/media/thumbs/${r.cover_photo_id}.webp` : null,
    }));
    return { ok: true, data: albums };
  });

  app.get("/api/my/albums/:id/photos", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    const { id } = req.params as { id: string };
    // 1 linha por foto com o MELHOR match (confirmado primeiro, depois menor
    // distância) — bbox + dimensões pra desenhar o quadrado no rosto certo
    const { rows } = await pool.query(
      `SELECT * FROM (
         SELECT DISTINCT ON (p.id)
                p.id, p.name, p.thumb_path, p.web_view_link, p.web_content_link,
                p.taken_at, p.width, p.height,
                m.face_id, m.distance, m.status AS match_status, f.bbox
         FROM matches m
         JOIN faces f ON f.id = m.face_id
         JOIN photos p ON p.id = f.photo_id
         WHERE m.user_id = $1 AND m.status <> 'rejected' AND p.album_id = $2
         ORDER BY p.id, (m.status = 'confirmed') DESC, m.distance ASC
       ) best
       ORDER BY best.taken_at NULLS LAST, best.name`,
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
      matchStatus: r.match_status,
      faceBbox: r.bbox ?? null,
      photoWidth: r.width,
      photoHeight: r.height,
      takenAt: r.taken_at ? new Date(r.taken_at).toISOString() : null,
    }));
    return { ok: true, data: photos };
  });

  // "Todas as fotos" — navegação completa do álbum (não só os matches), pra
  // o usuário se autoidentificar em fotos que o sistema não achou sozinho.
  // Só libera pra quem já é participante do álbum (≥1 match não-rejeitado).
  app.get("/api/my/albums/:id/all-photos", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    const { id } = req.params as { id: string };
    if (!(await isAlbumParticipant(id, user.id))) {
      return reply.status(403).send({ ok: false, error: "você ainda não aparece neste álbum" });
    }

    const { rows } = await pool.query(
      `SELECT p.id, p.name, p.thumb_path, p.width, p.height,
              COALESCE(
                JSON_AGG(
                  JSON_BUILD_OBJECT(
                    'faceId', f.id, 'bbox', f.bbox,
                    'claimedByMe', EXISTS (
                      SELECT 1 FROM matches m WHERE m.face_id = f.id AND m.user_id = $2 AND m.status <> 'rejected'
                    )
                  )
                ) FILTER (WHERE f.id IS NOT NULL), '[]'
              ) AS faces
       FROM photos p
       LEFT JOIN faces f ON f.photo_id = p.id
       WHERE p.album_id = $1 AND p.status = 'done'
       GROUP BY p.id
       ORDER BY p.taken_at NULLS LAST, p.name`,
      [id, user.id]
    );
    const photos: AllAlbumPhoto[] = rows.map((r) => ({
      id: r.id,
      name: r.name,
      thumbUrl: r.thumb_path ? `/api/media/thumbs/${r.id}.webp` : null,
      photoWidth: r.width,
      photoHeight: r.height,
      faces: r.faces,
    }));
    return { ok: true, data: photos };
  });

  // autoidentificação: usuário escolhe qual rosto é ele numa foto que o
  // sistema não casou sozinho (fluxo "Todas as fotos")
  app.post("/api/faces/:faceId/claim", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    const { faceId } = req.params as { faceId: string };

    const { rows } = await pool.query(
      `SELECT p.album_id FROM faces f JOIN photos p ON p.id = f.photo_id WHERE f.id = $1`,
      [faceId]
    );
    const albumId = rows[0]?.album_id as string | undefined;
    if (!albumId) return reply.status(404).send({ ok: false, error: "rosto não encontrado" });
    if (!(await isAlbumParticipant(albumId, user.id))) {
      return reply.status(403).send({ ok: false, error: "você ainda não aparece neste álbum" });
    }

    const added = await claimFace(faceId, user.id);
    if (added < 0) return reply.status(409).send({ ok: false, error: "essa pessoa já foi marcada como 'não sou eu'" });
    return { ok: true, data: { newMatches: added } };
  });

  // "sou eu" — confirma e expande (pessoa inteira + probe global). O usuário
  // "treina" o sistema: a face confirmada vira referência pra matches futuros.
  app.post("/api/my/matches/:faceId/confirm", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    const { faceId } = req.params as { faceId: string };
    const added = await confirmAndExpand(faceId, user.id);
    if (added < 0) return reply.status(404).send({ ok: false, error: "match não encontrado" });
    return { ok: true, data: { newMatches: added } };
  });

  // "não sou eu" — rejeita a pessoa inteira (cluster) neste e em matches futuros
  app.post("/api/my/matches/:faceId/reject", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    const { faceId } = req.params as { faceId: string };
    const ok = await rejectPerson(faceId, user.id);
    if (!ok) return reply.status(404).send({ ok: false, error: "match não encontrado" });
    return { ok: true, data: null };
  });
}
