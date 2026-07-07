import { randomBytes } from "crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import { config } from "../config.js";
import { getRedis } from "../redis.js";
import { pool } from "../db.js";
import type { UserRole } from "@face-lab/shared";

// Cookie HOST-ONLY em face.bit-lab.tech — nunca Domain=.bit-lab.tech, pra não
// interferir com o bl_session do auth (que também chega neste host e é ignorado).
export const COOKIE_NAME = "fl_session";
const KEY_PREFIX = "flsession:";

export interface SessionUser {
  id: string;
  oidcSub: string;
  email: string;
  displayName: string | null;
  role: UserRole;
}

export async function createSession(reply: FastifyReply, userId: string): Promise<void> {
  const token = randomBytes(32).toString("hex");
  const redis = await getRedis();
  await redis.set(KEY_PREFIX + token, JSON.stringify({ userId }), { EX: config.sessionTtlSeconds });
  reply.setCookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: config.isProd,
    sameSite: "lax",
    path: "/",
    maxAge: config.sessionTtlSeconds,
  });
}

/** Lê a sessão e carrega o usuário fresco do banco (papel pode mudar a qualquer momento). */
export async function readSession(req: FastifyRequest): Promise<SessionUser | null> {
  const token = req.cookies[COOKIE_NAME];
  if (!token) return null;
  const redis = await getRedis();
  const raw = await redis.get(KEY_PREFIX + token);
  if (!raw) return null;
  const { userId } = JSON.parse(raw) as { userId: string };
  const { rows } = await pool.query(
    "SELECT id, oidc_sub, email, display_name, role FROM users WHERE id = $1",
    [userId]
  );
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    oidcSub: row.oidc_sub,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
  };
}

export async function destroySession(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const token = req.cookies[COOKIE_NAME];
  if (token) {
    const redis = await getRedis();
    await redis.del(KEY_PREFIX + token);
  }
  reply.clearCookie(COOKIE_NAME, { path: "/" });
}
