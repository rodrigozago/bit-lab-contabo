const isProd = process.env["NODE_ENV"] === "production";

/**
 * Lê uma env. `devFallback` só é usado FORA de produção — em produção, uma env
 * sem valor real aborta o boot (em vez de subir com um default de localhost ou
 * string vazia, que quebra o login OIDC ou expõe config errada em silêncio).
 * Ver docs/SEGURANCA-PRE-LANCAMENTO.md item 3.
 */
const env = (name: string, devFallback?: string): string => {
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

export const config = {
  port: Number(process.env["PORT"] ?? 3001),
  isProd,
  publicUrl: env("PUBLIC_URL", "http://localhost:3001"),
  redisUrl: env("REDIS_URL", "redis://localhost:6379"),
  databaseUrl: env("DATABASE_URL", "postgres://ponto:ponto@localhost:5432/ponto"),
  sessionTtlSeconds: 60 * 60 * 24 * 7,

  oidc: {
    issuer: env("OIDC_ISSUER", "https://auth.bit-lab.tech"),
    clientId: env("OIDC_CLIENT_ID", "ponto-studio"),
    // dev tem um placeholder; em PRODUÇÃO é obrigatório (o `env` acima aborta
    // se faltar). Antes o default era "" pra todo ambiente e o client subia
    // sem segredo em silêncio na produção.
    clientSecret: env("OIDC_CLIENT_SECRET", "dev-oidc-client-secret"),
  },
};
