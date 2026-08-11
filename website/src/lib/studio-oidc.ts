import "server-only";
import { Issuer, generators, type Client } from "openid-client";

/** Client OIDC (BFF) contra o provedor self-hosted auth.bit-lab.tech —
 * mesmo padrão do sentinela (sentinela/apps/api/src/services/oidcClient.ts),
 * adaptado pra route handlers do Next.js e sem Redis (ver studio-session.ts). */
const ISSUER = process.env.STUDIO_OIDC_ISSUER || "https://auth.bit-lab.tech";
const CLIENT_ID = process.env.STUDIO_OIDC_CLIENT_ID || "studio";
const CLIENT_SECRET = process.env.STUDIO_OIDC_CLIENT_SECRET;

export function redirectUri(origin: string): string {
  return `${origin}/auth/callback`;
}

let clientPromise: Promise<Client> | null = null;

export function getOidcClient(origin: string): Promise<Client> {
  if (!CLIENT_SECRET) {
    throw new Error("STUDIO_OIDC_CLIENT_SECRET não definido");
  }
  if (!clientPromise) {
    clientPromise = Issuer.discover(ISSUER).then(
      (issuer) =>
        new issuer.Client({
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          redirect_uris: [redirectUri(origin)],
          response_types: ["code"],
          token_endpoint_auth_method: "client_secret_basic",
        }),
    );
  }
  return clientPromise;
}

export const oidcIssuer = ISSUER;

export interface PkceState {
  state: string;
  verifier: string;
  returnTo: string;
}

export function startPkce(returnTo: string): PkceState {
  return {
    state: generators.state(),
    verifier: generators.codeVerifier(),
    returnTo,
  };
}

export function codeChallenge(verifier: string): string {
  return generators.codeChallenge(verifier);
}
