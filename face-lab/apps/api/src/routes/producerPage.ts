import type { FastifyInstance } from "fastify";
import type { ProducerPageSettings } from "@face-lab/shared";
import { pool } from "../db.js";
import { requireProducer } from "../guards.js";

// Página pública do fotógrafo (/p/:slug) — configuração, lado producer.

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;
// caminhos já usados pelo app/web — não podem virar slug
const RESERVED_SLUGS = new Set([
  "api", "admin", "me", "producer", "p", "terms", "privacy", "resources", "consent", "enroll", "health",
]);

function toSettings(row: Record<string, unknown>): ProducerPageSettings {
  return {
    slug: String(row["slug"]),
    displayName: String(row["display_name"]),
    heroPhotoId: (row["hero_photo_id"] as string | null) ?? null,
    heroUrl: row["hero_photo_id"] ? `/api/media/thumbs/${row["hero_photo_id"]}.webp` : null,
    editorialMd: (row["editorial_md"] as string | null) ?? null,
  };
}

export async function producerPageRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/producer/page", async (req, reply) => {
    const user = await requireProducer(req, reply);
    if (!user) return;
    const { rows } = await pool.query(`SELECT * FROM producer_pages WHERE owner_id = $1`, [user.id]);
    return { ok: true, data: rows[0] ? toSettings(rows[0]) : null };
  });

  app.put("/api/producer/page", async (req, reply) => {
    const user = await requireProducer(req, reply);
    if (!user) return;

    const { slug, displayName, heroPhotoId, editorialMd } = (req.body ?? {}) as {
      slug?: string;
      displayName?: string;
      heroPhotoId?: string | null;
      editorialMd?: string | null;
    };

    const cleanSlug = (slug ?? "").trim().toLowerCase();
    if (!SLUG_RE.test(cleanSlug)) {
      return reply.status(400).send({ ok: false, error: "slug inválido (a-z, 0-9 e hífens, 2-40 caracteres)" });
    }
    if (RESERVED_SLUGS.has(cleanSlug)) {
      return reply.status(400).send({ ok: false, error: "esse slug é reservado" });
    }
    if (!displayName?.trim()) {
      return reply.status(400).send({ ok: false, error: "displayName é obrigatório" });
    }
    if (editorialMd != null && editorialMd.length > 10_000) {
      return reply.status(400).send({ ok: false, error: "editorial muito longo (máx 10 mil caracteres)" });
    }

    // hero precisa ser foto processada de um álbum do próprio producer
    if (heroPhotoId) {
      const { rows } = await pool.query(
        `SELECT 1 FROM photos p JOIN albums a ON a.id = p.album_id
         WHERE p.id = $1 AND a.owner_id = $2 AND p.status = 'done'`,
        [heroPhotoId, user.id]
      );
      if (!rows[0]) return reply.status(400).send({ ok: false, error: "foto de capa inválida" });
    }

    try {
      const { rows } = await pool.query(
        `INSERT INTO producer_pages (owner_id, slug, display_name, hero_photo_id, editorial_md)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (owner_id) DO UPDATE
           SET slug = EXCLUDED.slug, display_name = EXCLUDED.display_name,
               hero_photo_id = EXCLUDED.hero_photo_id, editorial_md = EXCLUDED.editorial_md,
               updated_at = now()
         RETURNING *`,
        [user.id, cleanSlug, displayName.trim(), heroPhotoId ?? null, editorialMd?.trim() || null]
      );
      return { ok: true, data: toSettings(rows[0]) };
    } catch (err) {
      // unique em lower(slug): outro producer já usa esse slug
      if ((err as { code?: string }).code === "23505") {
        return reply.status(409).send({ ok: false, error: "esse slug já está em uso" });
      }
      throw err;
    }
  });
}
