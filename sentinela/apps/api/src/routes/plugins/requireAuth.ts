import type { FastifyReply, FastifyRequest } from "fastify";
import { readSession, type SessionUser } from "../../services/session.js";
import { isTenantMember } from "../../services/tenants.js";

declare module "fastify" {
  interface FastifyRequest {
    user?: SessionUser;
  }
}

/** preHandler: exige sessão válida, popula req.user. */
export async function requireAuth(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const user = await readSession(req);
  if (!user) {
    reply.status(401).send({ ok: false, error: "não autenticado" });
    return;
  }
  req.user = user;
}

/** preHandler: exige sessão + is_admin (superuser central do bit-lab). */
export async function requireAdmin(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  await requireAuth(req, reply);
  if (reply.sent) return;

  if (!req.user!.isAdmin) {
    reply.status(403).send({ ok: false, error: "acesso restrito a admins" });
  }
}

/** preHandler: exige sessão + que o usuário pertença ao :tenantId da rota. */
export async function requireTenantMember(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  await requireAuth(req, reply);
  if (reply.sent) return;

  const { tenantId } = req.params as { tenantId?: string };
  if (!tenantId) {
    reply.status(400).send({ ok: false, error: "tenantId ausente" });
    return;
  }
  const member = await isTenantMember(tenantId, req.user!.email);
  if (!member) {
    reply.status(403).send({ ok: false, error: "sem acesso a este tenant" });
  }
}
