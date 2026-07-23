const isProd = process.env["NODE_ENV"] === "production";

/**
 * Env OBRIGATÓRIA em produção: sem valor real aborta o boot em prod (em vez de
 * subir com default de localhost/vazio em silêncio). `devFallback` só vale
 * fora de prod. Mesmo padrão do ponto-studio/face-lab (ver
 * SEGURANCA-PRE-LANCAMENTO.md deles).
 */
const envStrict = (name: string, devFallback?: string): string => {
  const v = process.env[name];
  if (v !== undefined && v !== "") return v;
  if (isProd) {
    throw new Error(`variável de ambiente obrigatória ausente em produção: ${name}`);
  }
  if (devFallback === undefined) {
    throw new Error(`variável de ambiente obrigatória ausente: ${name}`);
  }
  return devFallback;
};

const envOr = (name: string, fallback: string): string => {
  const v = process.env[name];
  return v !== undefined && v !== "" ? v : fallback;
};

export const config = {
  port: Number(process.env["PORT"] ?? 3001),
  isProd,
  publicUrl: envStrict("PUBLIC_URL", "http://localhost:3001"),
  redisUrl: envOr("REDIS_URL", "redis://localhost:6379"),
  databaseUrl: envOr("DATABASE_URL", "postgres://sentinela:sentinela@localhost:5432/sentinela"),
  sessionTtlSeconds: 60 * 60 * 24 * 7,
  openaiApiKey: envOr("OPENAI_API_KEY", ""),

  oidc: {
    issuer: envStrict("OIDC_ISSUER", "https://auth.bit-lab.tech"),
    clientId: envStrict("OIDC_CLIENT_ID", "sentinela"),
    clientSecret: envStrict("OIDC_CLIENT_SECRET", "dev-oidc-client-secret"),
  },
};
