import { mkdir, writeFile, rm } from "fs/promises";
import { join } from "path";
import type { FastifyInstance } from "fastify";
import { v4 as uuid } from "uuid";
import { pool } from "../db.js";
import { config } from "../config.js";
import { requireUser } from "../guards.js";
import { enqueue } from "../services/jobQueue.js";
import { tryEnrollSlot } from "../services/rateLimit.js";

const MIN_FRAMES = 3;
const MAX_FRAMES = 8;

export async function enrollmentRoutes(app: FastifyInstance): Promise<void> {
  // multipart com 3–8 frames JPEG capturados pela webcam (ou upload de fotos)
  app.post("/api/enrollment", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;

    if (!(await tryEnrollSlot())) {
      return reply.status(429).send({ ok: false, error: "muitos cadastros de rosto agora — tente de novo em 1 minuto" });
    }

    const enrollmentId = uuid();
    const frameDir = join(config.mediaDir, "enroll", enrollmentId);
    await mkdir(frameDir, { recursive: true });

    let frameCount = 0;
    let source = "webcam";
    try {
      for await (const part of req.parts()) {
        if (part.type !== "file") {
          if (part.fieldname === "source" && typeof part.value === "string") source = part.value;
          continue;
        }
        if (frameCount >= MAX_FRAMES) {
          await part.toBuffer(); // drena e ignora excedentes
          continue;
        }
        const buf = await part.toBuffer();
        await writeFile(join(frameDir, `frame_${frameCount}.jpg`), buf);
        frameCount++;
      }
    } catch (err) {
      await rm(frameDir, { recursive: true, force: true }).catch(() => {});
      throw err;
    }

    if (frameCount < MIN_FRAMES) {
      await rm(frameDir, { recursive: true, force: true }).catch(() => {});
      return reply.status(400).send({ ok: false, error: `envie pelo menos ${MIN_FRAMES} frames` });
    }

    // um enrollment ativo por usuário: desativa os anteriores (matches auto são
    // recalculados quando o novo ficar pronto — os antigos continuam válidos até lá)
    await pool.query(`UPDATE enrollments SET active = false WHERE user_id = $1`, [user.id]);
    await pool.query(
      `INSERT INTO enrollments (id, user_id, status, source, frame_count) VALUES ($1, $2, 'pending', $3, $4)`,
      [enrollmentId, user.id, source === "upload" ? "upload" : "webcam", frameCount]
    );

    await enqueue({ type: "enroll", enrollmentId, frameDir });
    return { ok: true, data: { enrollmentId } };
  });

  app.get("/api/enrollment", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    const { rows } = await pool.query(
      `SELECT id, status, error, source, frame_count, created_at
       FROM enrollments WHERE user_id = $1 AND active ORDER BY created_at DESC LIMIT 1`,
      [user.id]
    );
    const e = rows[0];
    return {
      ok: true,
      data: e
        ? { id: e.id, status: e.status, error: e.error, source: e.source, frameCount: e.frame_count, createdAt: e.created_at }
        : null,
    };
  });

  // privacidade: remove embedding + matches automáticos do usuário
  app.delete("/api/enrollment/:id", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    const { id } = req.params as { id: string };
    const { rowCount } = await pool.query(`DELETE FROM enrollments WHERE id = $1 AND user_id = $2`, [id, user.id]);
    if (!rowCount) return reply.status(404).send({ ok: false, error: "enrollment não encontrado" });
    await pool.query(`DELETE FROM matches WHERE user_id = $1 AND status = 'auto'`, [user.id]);
    await rm(join(config.mediaDir, "enroll", id), { recursive: true, force: true }).catch(() => {});
    return { ok: true, data: null };
  });
}
