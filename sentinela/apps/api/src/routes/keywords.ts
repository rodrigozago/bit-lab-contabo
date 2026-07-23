import type { FastifyInstance } from "fastify";
import { pool } from "../db.js";
import { requireTenantMember } from "./plugins/requireAuth.js";
import { syncTwitterSource } from "../services/sources.js";

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
    const keyword = rows[0];
    // keyword também vira busca no X — sem isso ela só filtra notícias, não
    // gera monitoramento social nenhum
    await syncTwitterSource(tenantId, termo, true);
    return reply.status(201).send({ ok: true, data: keyword });
  });

  app.patch("/api/tenants/:tenantId/keywords/:id", { preHandler: requireTenantMember }, async (req, reply) => {
    const { tenantId, id } = req.params as { tenantId: string; id: string };
    const { ativo } = req.body as { ativo?: boolean };
    if (typeof ativo !== "boolean") {
      return reply.status(400).send({ ok: false, error: "ativo (boolean) é obrigatório" });
    }
    const { rows } = await pool.query(
      `UPDATE keywords SET ativo = $3 WHERE id = $1 AND tenant_id = $2
       RETURNING id, tenant_id AS "tenantId", termo, ativo`,
      [id, tenantId, ativo]
    );
    if (rows.length === 0) return reply.status(404).send({ ok: false, error: "keyword não encontrada" });
    const keyword = rows[0];
    await syncTwitterSource(tenantId, keyword.termo, ativo);
    return { ok: true, data: keyword };
  });
}
