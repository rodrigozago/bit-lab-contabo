const env = (name: string, fallback?: string): string => {
  const v = process.env[name] ?? fallback;
  if (v === undefined) throw new Error(`variável de ambiente obrigatória ausente: ${name}`);
  return v;
};

export const config = {
  port: Number(process.env["PORT"] ?? 3001),
  isProd: process.env["NODE_ENV"] === "production",
  publicUrl: env("PUBLIC_URL", "http://localhost:3001"),
  redisUrl: env("REDIS_URL", "redis://localhost:6379"),
  sessionTtlSeconds: 60 * 60 * 24 * 7,

  oidc: {
    issuer: env("OIDC_ISSUER", "https://auth.bit-lab.tech"),
    clientId: env("OIDC_CLIENT_ID", "ponto-studio"),
    clientSecret: env("OIDC_CLIENT_SECRET", ""),
  },
};
