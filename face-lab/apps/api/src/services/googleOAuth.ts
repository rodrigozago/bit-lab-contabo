import { randomBytes } from "crypto";
import { config } from "../config.js";
import { getRedis } from "../redis.js";
import { pool } from "../db.js";
import { encrypt, decrypt } from "./crypto.js";

// OAuth do producer com o Google (drive.readonly) — implementado direto na API
// REST do Google, sem a lib googleapis (pesada demais pro que precisamos).

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPES = "openid email https://www.googleapis.com/auth/drive.readonly";
const STATE_PREFIX = "flgoogle:";

export function googleConfigured(): boolean {
  return Boolean(config.google.clientId && config.google.clientSecret && config.google.tokenEncKeyHex);
}

export async function startGoogleConnect(userId: string): Promise<string> {
  const state = randomBytes(16).toString("hex");
  const redis = await getRedis();
  await redis.set(STATE_PREFIX + state, userId, { EX: 300 });

  const params = new URLSearchParams({
    client_id: config.google.clientId,
    redirect_uri: config.google.redirectUri,
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    prompt: "consent", // garante refresh_token mesmo em reconexão
    state,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

function decodeJwtPayload(jwt: string): Record<string, unknown> {
  const part = jwt.split(".")[1];
  if (!part) return {};
  return JSON.parse(Buffer.from(part, "base64url").toString("utf-8"));
}

/** Callback do Google: valida state, troca code, salva refresh token criptografado. */
export async function finishGoogleConnect(code: string, state: string): Promise<string> {
  const redis = await getRedis();
  const userId = await redis.get(STATE_PREFIX + state);
  if (!userId) throw new Error("state inválido ou expirado — tente conectar de novo");
  await redis.del(STATE_PREFIX + state);

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.google.clientId,
      client_secret: config.google.clientSecret,
      redirect_uri: config.google.redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`troca de code com o Google falhou: ${res.status} ${await res.text()}`);
  const tokens = (await res.json()) as { refresh_token?: string; id_token?: string };
  if (!tokens.refresh_token) {
    throw new Error("Google não devolveu refresh_token — revogue o acesso em myaccount.google.com/permissions e tente de novo");
  }

  // id_token veio direto do Google via TLS — decodificar sem verificar é ok aqui
  const email = String(tokens.id_token ? decodeJwtPayload(tokens.id_token)["email"] ?? "" : "");

  await pool.query(
    `INSERT INTO google_credentials (user_id, google_email, refresh_token_enc, scopes, updated_at)
     VALUES ($1, $2, $3, $4, now())
     ON CONFLICT (user_id) DO UPDATE
       SET google_email = EXCLUDED.google_email,
           refresh_token_enc = EXCLUDED.refresh_token_enc,
           scopes = EXCLUDED.scopes,
           updated_at = now()`,
    [userId, email, encrypt(tokens.refresh_token), SCOPES]
  );
  return userId;
}

/** Access token fresco a partir do refresh token do producer. */
export async function getAccessToken(userId: string): Promise<string> {
  const { rows } = await pool.query("SELECT refresh_token_enc FROM google_credentials WHERE user_id = $1", [userId]);
  const row = rows[0];
  if (!row) throw new Error("producer não conectou o Google Drive");
  const refreshToken = decrypt(row.refresh_token_enc);

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: config.google.clientId,
      client_secret: config.google.clientSecret,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    throw new Error(`refresh do token Google falhou (${res.status}) — reconecte a conta Google. ${await res.text()}`);
  }
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

export async function getGoogleStatus(userId: string): Promise<{ connected: boolean; googleEmail: string | null }> {
  const { rows } = await pool.query("SELECT google_email FROM google_credentials WHERE user_id = $1", [userId]);
  return { connected: rows.length > 0, googleEmail: rows[0]?.google_email ?? null };
}

export async function disconnectGoogle(userId: string): Promise<void> {
  await pool.query("DELETE FROM google_credentials WHERE user_id = $1", [userId]);
}
