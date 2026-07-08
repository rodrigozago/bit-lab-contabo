const env = (name: string, fallback?: string): string => {
  const v = process.env[name] ?? fallback;
  if (v === undefined) throw new Error(`variável de ambiente obrigatória ausente: ${name}`);
  return v;
};

export const config = {
  port: Number(process.env["PORT"] ?? 3001),
  isProd: process.env["NODE_ENV"] === "production",
  publicUrl: env("PUBLIC_URL", "http://localhost:3004"),
  databaseUrl: env("DATABASE_URL", "postgres://facelab:facelab@localhost:5432/facelab"),
  redisUrl: env("REDIS_URL", "redis://localhost:6379"),
  mediaDir: env("MEDIA_DIR", "/media"),
  sessionSecret: env("SESSION_SECRET", "dev-secret-troque"),
  sessionTtlSeconds: 60 * 60 * 24 * 7,

  oidc: {
    issuer: env("OIDC_ISSUER", "https://auth.bit-lab.tech"),
    clientId: env("OIDC_CLIENT_ID", "face-lab"),
    clientSecret: env("OIDC_CLIENT_SECRET", ""),
  },

  google: {
    clientId: process.env["GOOGLE_CLIENT_ID"] ?? "",
    clientSecret: process.env["GOOGLE_CLIENT_SECRET"] ?? "",
    redirectUri: process.env["GOOGLE_REDIRECT_URI"] ?? `${env("PUBLIC_URL", "http://localhost:3004")}/api/google/callback`,
    tokenEncKeyHex: process.env["GOOGLE_TOKEN_ENC_KEY"] ?? "",
  },

  matchDistanceThreshold: Number(process.env["MATCH_DISTANCE_THRESHOLD"] ?? 0.4),
  // clustering pessoa↔face: mais frouxo que o match (pose/luz variam num evento)
  clusterDistanceThreshold: Number(process.env["CLUSTER_DISTANCE_THRESHOLD"] ?? 0.45),

  rate: {
    producerPerMin: Number(process.env["RATE_LIMIT_PRODUCER_PER_MIN"] ?? 30),
    globalPerMin: Number(process.env["RATE_LIMIT_GLOBAL_PER_MIN"] ?? 60),
    enrollPerMin: Number(process.env["RATE_LIMIT_ENROLL_PER_MIN"] ?? 10),
  },
};
