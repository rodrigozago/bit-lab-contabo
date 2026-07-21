import type Rollbar from "rollbar";

/**
 * Config do Rollbar do lado cliente. Só ativa se VITE_ROLLBAR_CLIENT_TOKEN
 * estiver definido no build — sem token, `enabled: false` desliga tudo (dev
 * e ambientes sem Rollbar não mandam nada). O token client-side é público por
 * natureza (post_client_item, escopo mínimo). Ver docs/SEGURANCA-PRE-LANCAMENTO.md
 * item 6.
 */
const token = import.meta.env["VITE_ROLLBAR_CLIENT_TOKEN"] as string | undefined;

export const rollbarConfig: Rollbar.Configuration = {
  accessToken: token,
  enabled: !!token,
  environment: import.meta.env.MODE ?? "development",
  captureUncaught: true,
  captureUnhandledRejections: true,
  payload: {
    // hash do build pra agrupar erros por versão (Vite injeta se configurado;
    // cai pra "dev" sem isso)
    code_version: (import.meta.env["VITE_BUILD_SHA"] as string) ?? "dev",
  },
  // não vaza cookies/tokens em payloads
  scrubFields: ["password", "authorization", "cookie", "ps_session", "token"],
};
