import type { FastifyInstance } from "fastify";
import { pool } from "../db.js";
import { requireTenantMember } from "./plugins/requireAuth.js";

interface CreateTargetBody {
  tipo: "candidato" | "partido" | "influenciador";
  nome: string;
  contasRedes?: Record<string, string>;
}

export async function targetsRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/tenants/:tenantId/targets", { preHandler: requireTenantMember }, async (req) => {
    const { tenantId } = req.params as { tenantId: string };
    const { rows } = await pool.query(
      `SELECT id, tenant_id AS "tenantId", tipo, nome, contas_redes AS "contasRedes", ativo
         FROM monitoring_targets WHERE tenant_id = $1 ORDER BY nome`,
      [tenantId]
    );
    return { ok: true, data: rows };
  });

  app.post("/api/tenants/:tenantId/targets", { preHandler: requireTenantMember }, async (req, reply) => {
    const { tenantId } = req.params as { tenantId: string };
    const { tipo, nome, contasRedes } = req.body as CreateTargetBody;
    if (!tipo || !nome) {
      return reply.status(400).send({ ok: false, error: "tipo e nome são obrigatórios" });
    }
    const { rows } = await pool.query(
      `INSERT INTO monitoring_targets (tenant_id, tipo, nome, contas_redes)
       VALUES ($1, $2, $3, $4)
       RETURNING id, tenant_id AS "tenantId", tipo, nome, contas_redes AS "contasRedes", ativo`,
      [tenantId, tipo, nome, JSON.stringify(contasRedes ?? {})]
    );
    return reply.status(201).send({ ok: true, data: rows[0] });
  });
}
