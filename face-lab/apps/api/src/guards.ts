import type { FastifyReply, FastifyRequest } from "fastify";
import { readSession, type SessionUser } from "./services/session.js";

// Guards de papel: guest ⊂ producer ⊂ admin. Devolvem null após já ter
// respondido 401/403 — o handler só segue se receber o usuário.

export async function requireUser(req: FastifyRequest, reply: FastifyReply): Promise<SessionUser | null> {
  const user = await readSession(req);
  if (!user) {
    await reply.status(401).send({ ok: false, error: "não autenticado" });
    return null;
  }
  return user;
}

export async function requireProducer(req: FastifyRequest, reply: FastifyReply): Promise<SessionUser | null> {
  const user = await requireUser(req, reply);
  if (!user) return null;
  if (user.role !== "producer" && user.role !== "admin") {
    await reply.status(403).send({ ok: false, error: "requer papel producer" });
    return null;
  }
  return user;
}

export async function requireAdmin(req: FastifyRequest, reply: FastifyReply): Promise<SessionUser | null> {
  const user = await requireUser(req, reply);
  if (!user) return null;
  if (user.role !== "admin") {
    await reply.status(403).send({ ok: false, error: "requer papel admin" });
    return null;
  }
  return user;
}
