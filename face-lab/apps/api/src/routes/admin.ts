import type { FastifyInstance } from "fastify";
import type { AdminUser } from "@face-lab/shared";
import { pool } from "../db.js";
import { config } from "../config.js";
import { requireAdmin } from "../guards.js";
import { rematchAll } from "../services/matching.js";

// admin não entra aqui: é gerenciado só no bit-lab-auth (is_admin) e espelhado no login
const ROLES = new Set(["guest", "producer"]);

export async function adminRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/admin/users", async (req, reply) => {
    const admin = await requireAdmin(req, reply);
    if (!admin) return;
    const { rows } = await pool.query(
      `SELECT u.id, u.email, u.role, u.created_at,
              EXISTS (SELECT 1 FROM enrollments e WHERE e.user_id = u.id AND e.active AND e.status = 'done') AS has_enrollment
       FROM users u ORDER BY u.created_at`
    );
    const users: AdminUser[] = rows.map((r) => ({
      id: r.id,
      email: r.email,
      role: r.role,
      createdAt: new Date(r.created_at).toISOString(),
      hasEnrollment: r.has_enrollment,
    }));
    return { ok: true, data: users };
  });

  app.patch("/api/admin/users/:id/role", async (req, reply) => {
    const admin = await requireAdmin(req, reply);
    if (!admin) return;
    const { id } = req.params as { id: string };
    const { role } = (req.body ?? {}) as { role?: string };
    if (!role || !ROLES.has(role)) {
      return reply.status(400).send({ ok: false, error: "role inválido — admin é gerenciado no bit-lab-auth" });
    }
    // não mexe em quem é admin (papel governado pelo is_admin do auth)
    const { rowCount } = await pool.query(
      `UPDATE users SET role = $2 WHERE id = $1 AND role <> 'admin'`,
      [id, role]
    );
    if (!rowCount) {
      return reply.status(400).send({ ok: false, error: "usuário não encontrado ou é admin (gerencie no bit-lab-auth)" });
    }
    return { ok: true, data: null };
  });

  app.post("/api/admin/rematch", async (req, reply) => {
    const admin = await requireAdmin(req, reply);
    if (!admin) return;
    const inserted = await rematchAll();
    return { ok: true, data: { matches: inserted, threshold: config.matchDistanceThreshold } };
  });

  app.get("/api/admin/stats", async (req, reply) => {
    const admin = await requireAdmin(req, reply);
    if (!admin) return;
    const { rows } = await pool.query(
      `SELECT
        (SELECT COUNT(*)::int FROM users) AS users,
        (SELECT COUNT(*)::int FROM albums) AS albums,
        (SELECT COUNT(*)::int FROM photos) AS photos,
        (SELECT COUNT(*)::int FROM faces) AS faces,
        (SELECT COUNT(*)::int FROM matches) AS matches,
        (SELECT COUNT(*)::int FROM enrollments WHERE active AND status = 'done') AS enrollments,
        (SELECT COUNT(*)::int FROM usage_events WHERE created_at > now() - interval '24 hours') AS usage_24h,
        (SELECT COUNT(*)::int FROM usage_events) AS usage_total`
    );
    return {
      ok: true,
      data: {
        ...rows[0],
        limits: {
          producerPerMin: config.rate.producerPerMin,
          globalPerMin: config.rate.globalPerMin,
          enrollPerMin: config.rate.enrollPerMin,
          matchDistanceThreshold: config.matchDistanceThreshold,
        },
      },
    };
  });

  // consumo por producer (matéria-prima dos planos futuros)
  app.get("/api/admin/usage", async (req, reply) => {
    const admin = await requireAdmin(req, reply);
    if (!admin) return;
    const { producerId, days } = req.query as { producerId?: string; days?: string };
    const since = Math.min(Math.max(Number(days ?? 30), 1), 365);
    const params: unknown[] = [`${since} days`];
    let where = `WHERE ue.created_at > now() - $1::interval`;
    if (producerId) {
      params.push(producerId);
      where += ` AND ue.user_id = $2`;
    }
    const { rows } = await pool.query(
      `SELECT u.email, ue.type, DATE(ue.created_at) AS day, COUNT(*)::int AS count
       FROM usage_events ue JOIN users u ON u.id = ue.user_id
       ${where}
       GROUP BY u.email, ue.type, day
       ORDER BY day DESC, u.email`,
      params
    );
    return { ok: true, data: rows };
  });
}
