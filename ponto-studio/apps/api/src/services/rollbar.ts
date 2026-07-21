import Rollbar from "rollbar";

/**
 * Rollbar (rastreio de erros) do lado servidor. Só liga se
 * ROLLBAR_SERVER_TOKEN estiver setado — em dev/sem token vira no-op, então
 * não atrapalha rodar local. Token é SECRETO (post_server_item), via env.
 * Ver docs/SEGURANCA-PRE-LANCAMENTO.md item 6.
 */
let instance: Rollbar | null = null;

export function initRollbar(): Rollbar | null {
  const accessToken = process.env["ROLLBAR_SERVER_TOKEN"];
  if (!accessToken) return null;
  instance = new Rollbar({
    accessToken,
    environment: process.env["NODE_ENV"] ?? "development",
    captureUncaught: true,
    captureUnhandledRejections: true,
    // não vaza segredo/cookie/senha nos payloads (scrubbing por nome de campo)
    scrubFields: [
      "password", "password2", "authorization", "cookie", "set-cookie",
      "client_secret", "code_verifier", "ps_session", "bl_session", "token",
    ],
    payload: { server: { root: process.cwd() } },
  });
  return instance;
}

export function getRollbar(): Rollbar | null {
  return instance;
}
