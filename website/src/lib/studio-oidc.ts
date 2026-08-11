import "server-only";
import { Issuer, generators, type Client } from "openid-client";

/** Client OIDC (BFF) contra o provedor self-hosted auth.bit-lab.tech —
 * mesmo padrão do sentinela (sentinela/apps/api/src/services/oidcClient.ts),
 * adaptado pra route handlers do Next.js e sem Redis (ver studio-session.ts).
 *
 * PUBLIC_URL é fixo via env, igual ao `config.publicUrl` do sentinela — NÃO
 * dá pra derivar de `request.nextUrl.origin` aqui: atrás do nginx + do
 * rewrite de src/proxy.ts, isso acaba refletindo o hostname interno do
 * container Docker (ex. "bceac5ca3820:3000"), não studio.bit-lab.tech. */
const ISSUER = process.env.STUDIO_OIDC_ISSUER || "https://auth.bit-lab.tech";
const CLIENT_ID = process.env.STUDIO_OIDC_CLIENT_ID || "studio";
const CLIENT_SECRET = process.env.STUDIO_OIDC_CLIENT_SECRET;
const PUBLIC_URL =
  process.env.STUDIO_PUBLIC_URL ||
  (process.env.NODE_ENV === "production"
    ? "https://studio.bit-lab.tech"
    : "http://localhost:3008");

export const REDIRECT_URI = `${PUBLIC_URL}/auth/callback`;
export { PUBLIC_URL };

let clientPromise: Promise<Client> | null = null;

export function getOidcClient(): Promise<Client> {
  if (!CLIENT_SECRET) {
    throw new Error("STUDIO_OIDC_CLIENT_SECRET não definido");
  }
  if (!clientPromise) {
    clientPromise = Issuer.discover(ISSUER).then(
      (issuer) =>
        new issuer.Client({
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          redirect_uris: [REDIRECT_URI],
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
