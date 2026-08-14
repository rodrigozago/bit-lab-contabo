import "server-only";
import { cookies } from "next/headers";
import { jwtVerify, SignJWT } from "jose";

/** Cookie de sessão da área studio — assinado (jose/HS256), sem estado no
 * servidor (website/ não tem Redis/Postgres, ao contrário dos outros
 * consumidores OIDC do repo). Host-only (sem `Domain=`) pra não colidir com
 * o bl_session do auth. */
export const SESSION_COOKIE = "studio_session";
const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12h — sessão curta, SSO cobre o resto

export interface StudioSession {
  sub: string;
  email: string;
  name: string | null;
  instagram: string | null;
  whatsapp: string | null;
}

function getSecret() {
  const secret = process.env.STUDIO_SESSION_SECRET;
  if (!secret) throw new Error("STUDIO_SESSION_SECRET não definido");
  return new TextEncoder().encode(secret);
}

export async function createStudioSessionCookie(
  user: StudioSession,
): Promise<{ name: string; value: string; maxAge: number }> {
  const token = await new SignJWT({
    email: user.email,
    name: user.name,
    instagram: user.instagram,
    whatsapp: user.whatsapp,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSecret());

  return { name: SESSION_COOKIE, value: token, maxAge: SESSION_TTL_SECONDS };
}

/** Lê e valida a sessão a partir do cookie da request atual. Retorna
 * `null` se ausente, expirada ou inválida — nunca lança. */
export async function getStudioSession(): Promise<StudioSession | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (!payload.sub) return null;
    return {
      sub: payload.sub,
      email: String(payload.email ?? ""),
      name: payload.name ? String(payload.name) : null,
      instagram: payload.instagram ? String(payload.instagram) : null,
      whatsapp: payload.whatsapp ? String(payload.whatsapp) : null,
    };
  } catch {
    return null;
  }
}

/** Cookie curto (5min) que carrega o par PKCE state/verifier + returnTo
 * entre /auth/login e /auth/callback — substitui o `redis.set(state, ...)`
 * do sentinela, já que website/ não tem Redis. */
export const PKCE_COOKIE = "studio_pkce";
const PKCE_TTL_SECONDS = 60 * 5;

export interface PkcePayload {
  state: string;
  verifier: string;
  returnTo: string;
}

export async function signPkceCookie(
  payload: PkcePayload,
): Promise<{ name: string; value: string; maxAge: number }> {
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${PKCE_TTL_SECONDS}s`)
    .sign(getSecret());

  return { name: PKCE_COOKIE, value: token, maxAge: PKCE_TTL_SECONDS };
}

export async function readPkceCookie(
  token: string | undefined,
): Promise<PkcePayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (!payload.state || !payload.verifier) return null;
    return {
      state: String(payload.state),
      verifier: String(payload.verifier),
      returnTo: String(payload.returnTo ?? "/"),
    };
  } catch {
    return null;
  }
}
