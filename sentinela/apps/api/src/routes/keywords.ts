import type { FastifyInstance } from "fastify";
import { pool } from "../db.js";
import { requireTenantMember } from "./plugins/requireAuth.js";

export async function keywordsRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/tenants/:tenantId/keywords", { preHandler: requireTenantMember }, async (req) => {
    const { tenantId } = req.params as { tenantId: string };
    const { rows } = await pool.query(
      `SELECT id, tenant_id AS "tenantId", termo, ativo
         FROM keywords WHERE tenant_id = $1 ORDER BY termo`,
      [tenantId]
    );
    return { ok: true, data: rows };
  });

  app.post("/api/tenants/:tenantId/keywords", { preHandler: requireTenantMember }, async (req, reply) => {
    const { tenantId } = req.params as { tenantId: string };
    const { termo } = req.body as { termo?: string };
    if (!termo) return reply.status(400).send({ ok: false, error: "termo é obrigatório" });
    const { rows } = await pool.query(
      `INSERT INTO keywords (tenant_id, termo) VALUES ($1, $2)
       RETURNING id, tenant_id AS "tenantId", termo, ativo`,
      [tenantId, termo]
    );
    return reply.status(201).send({ ok: true, data: rows[0] });
  });
}
