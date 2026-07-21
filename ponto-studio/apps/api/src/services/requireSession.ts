import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { readSession, type SessionUser } from "./session.js";

declare module "fastify" {
  interface FastifyRequest {
    sessionUser?: SessionUser;
  }
}

/**
 * preHandler compartilhado: exige uma sessão `ps_session` válida e a expõe em
 * `req.sessionUser`. Antes só `projects`/`hoops` faziam isso inline — as
 * demais rotas (export/preview/analyze/upload) subiam SEM auth, o que permitia
 * a qualquer anônimo baixar o desenho de qualquer projeto (IDOR) e abusar dos
 * jobs pesados do worker. Ver docs/SEGURANCA-PRE-LANCAMENTO.md item 1.
 */
export async function requireSession(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const user = await readSession(req);
  if (!user) {
    reply.status(401).send({ ok: false, error: "não autenticado" });
    return;
  }
  req.sessionUser = user;
}

/** Registra o preHandler de sessão em todas as rotas de um plugin. */
export function registerRequireSession(app: FastifyInstance): void {
  app.addHook("preHandler", requireSession);
}

/** id do dono a partir da sessão já validada pelo preHandler. */
export function ownerId(req: FastifyRequest): string {
  return req.sessionUser!.sub;
}
