import { join } from "path";
import type { FastifyInstance } from "fastify";
import type { PublicAlbum, PublicAlbumCard, PublicPage, PublicPhoto } from "@face-lab/shared";
import { pool } from "../db.js";
import { config } from "../config.js";
import { sendWebp } from "./media.js";

// Portfólio público do fotógrafo — ÚNICAS rotas de dados sem guard do app.
// A exposição é 100% opt-in do producer: só aparece o que ele featurou
// (albums.featured_at + photos.featured_at) ou escolheu como hero da página.
// Fotos preferem a thumb SEM marca d'água (clean_thumb_path) com fallback pra
// thumb normal enquanto o reprocessamento não termina.

const FILE_RE = /^([0-9a-f-]{36})\.webp$/;

const publicMediaUrl = (photoId: string) => `/api/public/media/${photoId}.webp`;

export async function publicRoutes(app: FastifyInstance): Promise<void> {
  // página do artista: hero + editorial + álbuns featured (card = 1ª foto featured)
  app.get("/api/public/pages/:slug", async (req, reply) => {
    const { slug } = req.params as { slug: string };
    const { rows } = await pool.query(
      `SELECT owner_id, slug, display_name, hero_photo_id, editorial_md
       FROM producer_pages WHERE lower(slug) = lower($1)`,
      [slug]
    );
    const page = rows[0];
    if (!page) return reply.status(404).send({ ok: false, error: "página não encontrada" });

    const albums = await pool.query(
      `SELECT a.id, a.name,
              (SELECT p.id FROM photos p
               WHERE p.album_id = a.id AND p.featured_at IS NOT NULL AND p.status = 'done'
               ORDER BY p.featured_at ASC LIMIT 1) AS cover_photo_id,
              (SELECT COUNT(*)::int FROM photos p
               WHERE p.album_id = a.id AND p.featured_at IS NOT NULL AND p.status = 'done') AS featured_photo_count
       FROM albums a
       WHERE a.owner_id = $1 AND a.featured_at IS NOT NULL
       ORDER BY a.featured_at DESC`,
      [page.owner_id]
    );

    const cards: PublicAlbumCard[] = albums.rows.map((a) => ({
      id: a.id,
      name: a.name,
      featuredImageUrl: a.cover_photo_id ? publicMediaUrl(a.cover_photo_id) : null,
      featuredPhotoCount: a.featured_photo_count,
    }));

    const data: PublicPage = {
      slug: page.slug,
      displayName: page.display_name,
      heroUrl: page.hero_photo_id ? publicMediaUrl(page.hero_photo_id) : null,
      editorialMd: page.editorial_md,
      albums: cards,
    };
    return { ok: true, data };
  });

  // álbum featured: só as fotos featured processadas
  app.get("/api/public/pages/:slug/albums/:albumId", async (req, reply) => {
    const { slug, albumId } = req.params as { slug: string; albumId: string };
    const { rows } = await pool.query(
      `SELECT a.id, a.name, pg.slug, pg.display_name
       FROM albums a
       JOIN producer_pages pg ON pg.owner_id = a.owner_id
       WHERE a.id = $1 AND lower(pg.slug) = lower($2) AND a.featured_at IS NOT NULL`,
      [albumId, slug]
    );
    const album = rows[0];
    if (!album) return reply.status(404).send({ ok: false, error: "álbum não encontrado" });

    const photos = await pool.query(
      `SELECT id, width, height FROM photos
       WHERE album_id = $1 AND featured_at IS NOT NULL AND status = 'done'
       ORDER BY featured_at ASC`,
      [albumId]
    );

    const data: PublicAlbum = {
      id: album.id,
      name: album.name,
      slug: album.slug,
      displayName: album.display_name,
      photos: photos.rows.map(
        (p): PublicPhoto => ({ id: p.id, url: publicMediaUrl(p.id), width: p.width, height: p.height })
      ),
    };
    return { ok: true, data };
  });

  // mídia pública: whitelist — foto featured de álbum featured de dono com
  // página, OU hero da página. Prefere clean_thumb_path (sem marca d'água).
  app.get("/api/public/media/:file", async (req, reply) => {
    const { file } = req.params as { file: string };
    const m = FILE_RE.exec(file);
    if (!m) return reply.status(400).send({ ok: false, error: "nome inválido" });
    const photoId = m[1];

    const { rows } = await pool.query(
      `SELECT COALESCE(p.clean_thumb_path, p.thumb_path) AS path
       FROM photos p
       JOIN albums a ON a.id = p.album_id
       JOIN producer_pages pg ON pg.owner_id = a.owner_id
       WHERE p.id = $1 AND p.status = 'done' AND (
         (p.featured_at IS NOT NULL AND a.featured_at IS NOT NULL)
         OR pg.hero_photo_id = p.id
       )`,
      [photoId]
    );
    const path = rows[0]?.path as string | undefined;
    if (!path) return reply.status(404).send({ ok: false, error: "não encontrado" });
    return sendWebp(reply, join(config.mediaDir, path), "public, max-age=3600");
  });
}
