import { Issuer, generators, type Client } from "openid-client";
import { config } from "../config.js";
import { getRedis } from "../redis.js";

// BFF: a API é o client OIDC confidencial; a SPA nunca vê tokens.
const REDIRECT_URI = `${config.publicUrl}/api/auth/callback`;
const STATE_PREFIX = "flauth:";
const STATE_TTL = 300; // 5 min pra completar o login

let client: Client | null = null;

export async function getOidcClient(): Promise<Client> {
  if (client) return client;
  // retry: o auth pode ainda estar subindo junto no docker compose
  let lastErr: unknown;
  for (let attempt = 1; attempt <= 10; attempt++) {
    try {
      const issuer = await Issuer.discover(config.oidc.issuer);
      client = new issuer.Client({
        client_id: config.oidc.clientId,
        client_secret: config.oidc.clientSecret,
        redirect_uris: [REDIRECT_URI],
        response_types: ["code"],
        token_endpoint_auth_method: "client_secret_basic",
      });
      console.log(`[oidc] discovery ok: ${config.oidc.issuer}`);
      return client;
    } catch (err) {
      lastErr = err;
      console.warn(`[oidc] discovery falhou (tentativa ${attempt}/10), retry em 3s...`);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  throw new Error(`OIDC discovery falhou em ${config.oidc.issuer}: ${String(lastErr)}`);
}

export interface AuthStart {
  url: string;
  state: string;
}

/** Gera URL de autorização (code + PKCE) e guarda verifier/returnTo no Redis. */
export async function startAuth(returnTo: string): Promise<AuthStart> {
  const oidc = await getOidcClient();
  const state = generators.state();
  const verifier = generators.codeVerifier();
  const challenge = generators.codeChallenge(verifier);

  const redis = await getRedis();
  await redis.set(STATE_PREFIX + state, JSON.stringify({ verifier, returnTo }), { EX: STATE_TTL });

  const url = oidc.authorizationUrl({
    scope: "openid email",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });
  return { url, state };
}

export interface AuthClaims {
  sub: string;
  email: string;
  isAdmin: boolean;
  returnTo: string;
}

/** Troca o code por tokens e devolve as claims do usuário. */
export async function finishAuth(callbackParams: Record<string, string>): Promise<AuthClaims> {
  const oidc = await getOidcClient();
  const state = callbackParams["state"];
  if (!state) throw new Error("state ausente no callback");

  const redis = await getRedis();
  const raw = await redis.get(STATE_PREFIX + state);
  if (!raw) throw new Error("state desconhecido ou expirado — recomece o login");
  await redis.del(STATE_PREFIX + state);
  const { verifier, returnTo } = JSON.parse(raw) as { verifier: string; returnTo: string };

  const tokenSet = await oidc.callback(REDIRECT_URI, callbackParams, {
    state,
    code_verifier: verifier,
  });
  const idClaims = tokenSet.claims();
  if (!idClaims.sub) throw new Error("ID token sem sub");

  // Claims de scope (email, is_admin) vêm do endpoint USERINFO, não do ID token:
  // o oidc-provider segue a conformidade OIDC e, com userinfo habilitado, o ID
  // token carrega só o sub. tokenSet.claims() sozinho devolveria email vazio.
  const userinfo = await oidc.userinfo(tokenSet);

  return {
    sub: idClaims.sub,
    email: String(userinfo["email"] ?? idClaims["email"] ?? ""),
    isAdmin: Boolean(userinfo["is_admin"] ?? idClaims["is_admin"]),
    returnTo: returnTo || "/",
  };
}
