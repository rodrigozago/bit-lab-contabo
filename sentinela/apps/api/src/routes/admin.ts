import type { FastifyInstance } from "fastify";
import { pool } from "../db.js";
import { requireAdmin } from "./plugins/requireAuth.js";

// Dashboard de scraping — visão operacional da plataforma (não é dado de
// tenant), por isso gated por is_admin (superuser central do bit-lab) e não
// pelo mesmo requireTenantMember das outras rotas.
export async function adminRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/admin/scrape-runs", { preHandler: requireAdmin }, async (req) => {
    const { worker, status, limit } = req.query as { worker?: string; status?: string; limit?: string };
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (worker) {
      params.push(worker);
      conditions.push(`sr.worker = $${params.length}`);
    }
    if (status) {
      params.push(status);
      conditions.push(`sr.status = $${params.length}`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    params.push(Math.min(Number(limit ?? 100), 500));

    const { rows } = await pool.query(
      `SELECT sr.id, sr.worker, sr.source_id AS "sourceId", s.url_ou_handle AS "sourceLabel",
              sr.status, sr.mensagem, sr.itens, sr.executado_em AS "executadoEm"
         FROM scrape_runs sr
         LEFT JOIN sources s ON s.id = sr.source_id
         ${where}
        ORDER BY sr.executado_em DESC
        LIMIT $${params.length}`,
      params
    );
    return { ok: true, data: rows };
  });

  app.get("/api/admin/sources", { preHandler: requireAdmin }, async () => {
    const { rows } = await pool.query(
      `SELECT s.id, s.tipo, s.url_ou_handle AS "urlOuHandle", s.ativo,
              last_run.executado_em AS "ultimaExecucao", last_run.status AS "ultimoStatus"
         FROM sources s
         LEFT JOIN LATERAL (
           SELECT executado_em, status FROM scrape_runs
            WHERE source_id = s.id
            ORDER BY executado_em DESC
            LIMIT 1
         ) last_run ON true
        ORDER BY s.tipo, s.url_ou_handle`
    );
    return { ok: true, data: rows };
  });

  // nunca retorna auth_token/ct0 — só metadados, mesmo pro admin
  app.get("/api/admin/social-accounts", { preHandler: requireAdmin }, async () => {
    const { rows } = await pool.query(
      `SELECT id, username, ativo, proxy_url AS "proxyUrl", criado_em AS "criadoEm"
         FROM social_accounts ORDER BY criado_em`
    );
    return { ok: true, data: rows };
  });

  app.patch("/api/admin/social-accounts/:id", { preHandler: requireAdmin }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { ativo } = req.body as { ativo?: boolean };
    if (typeof ativo !== "boolean") {
      return reply.status(400).send({ ok: false, error: "ativo (boolean) é obrigatório" });
    }
    const { rows } = await pool.query(
      `UPDATE social_accounts SET ativo = $2 WHERE id = $1
       RETURNING id, username, ativo, proxy_url AS "proxyUrl", criado_em AS "criadoEm"`,
      [id, ativo]
    );
    if (rows.length === 0) return reply.status(404).send({ ok: false, error: "conta não encontrada" });
    return { ok: true, data: rows[0] };
  });
}
