import Rollbar from "rollbar";

// Precisa de um token post_server_item (diferente do token de client do web).
// Sem o token, tudo aqui vira no-op — a API funciona normal sem Rollbar.
const token = process.env["ROLLBAR_SERVER_TOKEN"];

// Nível mínimo dos console.* encaminhados. Alpha = "debug" (loga tudo);
// depois troca pra "error" no .env + `docker compose up -d api` (runtime).
const MIN_LEVEL = (process.env["ROLLBAR_MIN_LEVEL"] ?? "debug").toLowerCase();
const LEVEL_ORDER: Record<string, number> = { debug: 0, info: 1, warning: 2, error: 3 };

export const rollbar: Rollbar | null = token
  ? new Rollbar({
      accessToken: token,
      environment: process.env["NODE_ENV"] ?? "development",
      captureUncaught: true,
      captureUnhandledRejections: true,
      itemsPerMinute: 60,
      scrubFields: ["password", "token", "secret", "authorization", "cookie", "csrf_token"],
    })
  : null;

function shouldForward(level: string): boolean {
  return (LEVEL_ORDER[level] ?? 0) >= (LEVEL_ORDER[MIN_LEVEL] ?? 0);
}

/**
 * Envolve console.log/info/warn/error/debug: continua imprimindo (docker logs)
 * e TAMBÉM manda pro Rollbar — cobre todos os logs de serviço ([scan],
 * [retention], [jobQueue], [thumb-regen]...), que usam console.*.
 * Flag de reentrância evita loop se o próprio Rollbar logar algo.
 */
export function installConsoleForwarding(): void {
  if (!rollbar) return;
  const rb = rollbar;

  let forwarding = false;
  const wrap = (method: "log" | "info" | "warn" | "error" | "debug", level: "debug" | "info" | "warning" | "error") => {
    const original = console[method].bind(console);
    console[method] = (...args: unknown[]) => {
      original(...args);
      if (forwarding || !shouldForward(level)) return;
      forwarding = true;
      try {
        const message = args
          .map((a) => (a instanceof Error ? a.message : typeof a === "string" ? a : safeStringify(a)))
          .join(" ");
        const error = args.find((a): a is Error => a instanceof Error);
        rb[level](message || "(console vazio)", error ?? undefined);
      } finally {
        forwarding = false;
      }
    };
  };

  wrap("debug", "debug");
  wrap("log", "info");
  wrap("info", "info");
  wrap("warn", "warning");
  wrap("error", "error");
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
