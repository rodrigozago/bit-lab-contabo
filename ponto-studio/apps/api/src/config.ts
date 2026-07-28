const isProd = process.env["NODE_ENV"] === "production";

/**
 * Lê uma env. `devFallback` só é usado FORA de produção — em produção, uma env
 * sem valor real aborta o boot (em vez de subir com um default de localhost ou
 * string vazia, que quebra o login OIDC ou expõe config errada em silêncio).
 * Ver docs/SEGURANCA-PRE-LANCAMENTO.md item 3.
 */
/**
 * Env OBRIGATÓRIA em produção: sem valor real aborta o boot em prod (em vez de
 * subir com default de localhost/vazio em silêncio). `devFallback` só vale
 * fora de prod. Use SÓ pras vars que a produção realmente precisa ter setadas
 * de propósito (segredo do OIDC etc.) — ver docs/SEGURANCA-PRE-LANCAMENTO.md.
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

/**
 * Env com default que vale em QUALQUER ambiente (inclusive prod). Pra vars que
 * têm um fallback legítimo mesmo em produção — ex.: DATABASE_URL só é usada
 * quando PGHOST não está setado (o compose usa PGHOST/PGUSER/... discretos, e
 * o `pg` os lê nativamente), então torná-la estrita quebrava o boot em prod.
 */
const envOr = (name: string, fallback: string): string => {
  const v = process.env[name];
  return v !== undefined && v !== "" ? v : fallback;
};

export const config = {
  port: Number(process.env["PORT"] ?? 3001),
  isProd,
  publicUrl: envStrict("PUBLIC_URL", "http://localhost:3001"),
  redisUrl: envOr("REDIS_URL", "redis://localhost:6379"),
  databaseUrl: envOr("DATABASE_URL", "postgres://ponto:ponto@localhost:5432/ponto"),
  sessionTtlSeconds: 60 * 60 * 24 * 7,

  oidc: {
    issuer: envStrict("OIDC_ISSUER", "https://auth.bit-lab.tech"),
    clientId: envStrict("OIDC_CLIENT_ID", "bordado-digital"),
    // dev tem um placeholder; em PRODUÇÃO é obrigatório (o `envStrict` aborta
    // se faltar). Antes o default era "" pra todo ambiente e o client subia
    // sem segredo em silêncio na produção.
    clientSecret: envStrict("OIDC_CLIENT_SECRET", "dev-oidc-client-secret"),
  },
};
