import { randomBytes } from "crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import { config } from "../config.js";
import { getRedis } from "../redis.js";

// Cookie HOST-ONLY em bordado.digital — nunca Domain=.bit-lab.tech, pra não
// interferir com o bl_session do auth (que também chega neste host e é ignorado).
export const COOKIE_NAME = "ps_session";
const KEY_PREFIX = "pssession:";

export interface SessionUser {
  sub: string;
  email: string;
  isAdmin: boolean;
}

// Sem Postgres no ponto-studio: a sessão guarda as claims direto no Redis
// (sub/email/isAdmin vêm do OIDC), sem tabela local de usuários pra espelhar.
export async function createSession(reply: FastifyReply, user: SessionUser): Promise<void> {
  const token = randomBytes(32).toString("hex");
  const redis = await getRedis();
  await redis.set(KEY_PREFIX + token, JSON.stringify(user), { EX: config.sessionTtlSeconds });
  reply.setCookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: config.isProd,
    sameSite: "lax",
    path: "/",
    maxAge: config.sessionTtlSeconds,
  });
}

export async function readSession(req: FastifyRequest): Promise<SessionUser | null> {
  const token = req.cookies[COOKIE_NAME];
  if (!token) return null;
  const redis = await getRedis();
  const raw = await redis.get(KEY_PREFIX + token);
  if (!raw) return null;
  return JSON.parse(raw) as SessionUser;
}

export async function destroySession(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const token = req.cookies[COOKIE_NAME];
  if (token) {
    const redis = await getRedis();
    await redis.del(KEY_PREFIX + token);
  }
  reply.clearCookie(COOKIE_NAME, { path: "/" });
}
