import type { FastifyReply, FastifyRequest } from "fastify";

/**
 * preHandler de ROTA (não de plugin inteiro): exige que `req.sessionUser`
 * (já populado pelo `requireSession` do plugin) tenha `isAdmin=true`. O
 * Fastify roda os hooks de plugin (`addHook`) ANTES do `preHandler` passado
 * nas opções de uma rota individual — por isso dá pra empilhar
 * `registerRequireSession(app)` (todo o plugin exige login) com
 * `{ preHandler: requireAdmin }` só nas rotas de escrita.
 */
export async function requireAdmin(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (!req.sessionUser?.isAdmin) {
    reply.status(403).send({ ok: false, error: "Acesso restrito a administradores" });
    return;
  }
}
