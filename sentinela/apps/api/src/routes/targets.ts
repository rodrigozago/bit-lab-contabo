import type { FastifyInstance } from "fastify";
import { pool } from "../db.js";
import { requireTenantMember } from "./plugins/requireAuth.js";
import { deactivateTwitterSource, syncTwitterSource } from "../services/sources.js";

interface CreateTargetBody {
  tipo: "candidato" | "partido" | "influenciador";
  nome: string;
  contasRedes?: Record<string, string>;
}

interface UpdateTargetBody {
  ativo?: boolean;
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
    const target = rows[0];
    // sem isso, cadastrar o alvo aqui não gera nenhum scraping de verdade —
    // ver services/sources.ts
    if (contasRedes?.twitter) {
      await syncTwitterSource(tenantId, contasRedes.twitter, true);
    }
    return reply.status(201).send({ ok: true, data: target });
  });

  app.patch("/api/tenants/:tenantId/targets/:id", { preHandler: requireTenantMember }, async (req, reply) => {
    const { tenantId, id } = req.params as { tenantId: string; id: string };
    const { ativo, contasRedes } = req.body as UpdateTargetBody;

    const { rows: before } = await pool.query(
      `SELECT contas_redes AS "contasRedes" FROM monitoring_targets WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId]
    );
    if (before.length === 0) return reply.status(404).send({ ok: false, error: "alvo não encontrado" });
    const previousTwitter = before[0].contasRedes?.twitter as string | undefined;

    const { rows } = await pool.query(
      `UPDATE monitoring_targets SET
         ativo = COALESCE($3, ativo),
         contas_redes = COALESCE($4, contas_redes)
       WHERE id = $1 AND tenant_id = $2
       RETURNING id, tenant_id AS "tenantId", tipo, nome, contas_redes AS "contasRedes", ativo`,
      [id, tenantId, ativo ?? null, contasRedes ? JSON.stringify(contasRedes) : null]
    );
    const target = rows[0];
    const newTwitter = target.contasRedes?.twitter as string | undefined;

    // re-sincroniza a source de X: desativa a antiga se o handle mudou/sumiu
    // ou se o alvo foi desativado; ativa/atualiza a atual quando aplicável
    if (previousTwitter && previousTwitter !== newTwitter) {
      await deactivateTwitterSource(tenantId, previousTwitter);
    }
    if (newTwitter) {
      await syncTwitterSource(tenantId, newTwitter, target.ativo);
    }

    return { ok: true, data: target };
  });
}
