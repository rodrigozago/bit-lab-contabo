import type Rollbar from "rollbar";

// Token de client (post_client_item) é público por design — embutido no bundle
// pelo Vite em BUILD time (por isso o Dockerfile do web recebe como ARG).
const token = import.meta.env.VITE_ROLLBAR_ACCESS_TOKEN as string | undefined;

// Nível mínimo dos console.* que vão pro Rollbar. Alpha = "debug" (loga tudo);
// depois troca pra "error" no .env + rebuild do web — sem mexer em código.
const MIN_LEVEL = ((import.meta.env.VITE_ROLLBAR_MIN_LEVEL as string | undefined) ?? "debug").toLowerCase();

const LEVEL_ORDER: Record<string, number> = { debug: 0, info: 1, warning: 2, error: 3 };

export const rollbarConfig: Rollbar.Configuration = {
  accessToken: token ?? "",
  enabled: Boolean(token),
  environment: import.meta.env.MODE,
  captureUncaught: true,
  captureUnhandledRejections: true,
  itemsPerMinute: 60, // teto de segurança mesmo no modo "loga tudo"
  scrubFields: ["password", "token", "secret", "authorization", "cookie", "csrf_token"],
};

function shouldForward(level: string): boolean {
  return (LEVEL_ORDER[level] ?? 0) >= (LEVEL_ORDER[MIN_LEVEL] ?? 0);
}

/**
 * Envolve console.log/info/warn/error/debug: continua imprimindo no console
 * e TAMBÉM manda pro Rollbar (respeitando MIN_LEVEL). Flag de reentrância
 * evita loop caso o próprio Rollbar (ou seu transporte) logue algo.
 */
export function installConsoleForwarding(rollbar: Rollbar): void {
  if (!token) return;

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
        rollbar[level](message || "(console vazio)", error ?? undefined);
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
