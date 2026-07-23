import type { FastifyInstance } from "fastify";
import { pool } from "../db.js";
import { requireTenantMember } from "./plugins/requireAuth.js";

export async function mentionsRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/tenants/:tenantId/mentions", { preHandler: requireTenantMember }, async (req) => {
    const { tenantId } = req.params as { tenantId: string };
    const { targetId, limit } = req.query as { targetId?: string; limit?: string };
    const params: unknown[] = [tenantId];
    let where = "tenant_id = $1";
    if (targetId) {
      params.push(targetId);
      where += ` AND target_id = $${params.length}`;
    }
    params.push(Math.min(Number(limit ?? 50), 200));
    const { rows } = await pool.query(
      `SELECT id, tenant_id AS "tenantId", target_id AS "targetId", keyword_id AS "keywordId",
              texto, url, publicado_em AS "publicadoEm", sentimento, score, entidades
         FROM mentions WHERE ${where}
        ORDER BY publicado_em DESC NULLS LAST
        LIMIT $${params.length}`,
      params
    );
    return { ok: true, data: rows };
  });
}
