import type { FastifyInstance } from "fastify";
import { pool } from "../db.js";
import { requireAuth } from "./plugins/requireAuth.js";
import { generateUniqueSlug, listTenantsForUser } from "../services/tenants.js";

export async function tenantsRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/tenants", { preHandler: requireAuth }, async (req) => {
    const tenants = await listTenantsForUser(req.user!.email);
    return { ok: true, data: tenants };
  });

  // criação self-serve simples pro MVP — quem cria vira owner. Sem convite
  // entre tenants ainda (fase 2). Cliente só digita o nome — slug é gerado
  // no servidor (ver generateUniqueSlug), não é algo que ele deveria pensar.
  app.post("/api/tenants", { preHandler: requireAuth }, async (req, reply) => {
    const { nome } = req.body as { nome?: string };
    if (!nome) return reply.status(400).send({ ok: false, error: "nome é obrigatório" });

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const slug = await generateUniqueSlug(nome);
      const { rows } = await client.query(
        `INSERT INTO tenants (nome, slug) VALUES ($1, $2) RETURNING id, nome, slug, plano`,
        [nome, slug]
      );
      const tenant = rows[0];
      await client.query(
        `INSERT INTO tenant_users (tenant_id, user_email, role) VALUES ($1, $2, 'owner')`,
        [tenant.id, req.user!.email]
      );
      await client.query("COMMIT");
      return reply.status(201).send({ ok: true, data: tenant });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  });
}
