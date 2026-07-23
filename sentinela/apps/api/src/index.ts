import Fastify from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { authRoutes } from "./routes/auth.js";
import { healthRoutes } from "./routes/health.js";
import { tenantsRoutes } from "./routes/tenants.js";
import { targetsRoutes } from "./routes/targets.js";
import { keywordsRoutes } from "./routes/keywords.js";
import { mentionsRoutes } from "./routes/mentions.js";
import { adminRoutes } from "./routes/admin.js";
import { migrate } from "./db.js";
import { config } from "./config.js";

// trustProxy: atrás do nginx da VPS — só o loopback é exposto, então confiar
// no proxy local é seguro (mesmo padrão do ponto-studio/face-lab).
const app = Fastify({ logger: { level: "info" }, trustProxy: true });

app.setErrorHandler((err, req, reply) => {
  app.log.error({ err, url: req.url }, "erro na requisição");
  const status = err.statusCode ?? 500;
  reply.status(status).send({ ok: false, error: status >= 500 ? "erro interno" : err.message });
});

// Postgres guarda tenants/targets/mentions — não faz sentido subir sem ele.
await migrate();

const corsOrigins = config.isProd
  ? [config.publicUrl]
  : [config.publicUrl, /^http:\/\/localhost:\d+$/];
await app.register(cors, { origin: corsOrigins, credentials: true });
await app.register(cookie);
await app.register(helmet, { contentSecurityPolicy: false });
await app.register(rateLimit, {
  global: true,
  max: 120,
  timeWindow: "1 minute",
  allowList: (req) => req.url === "/health",
});

await app.register(healthRoutes);
await app.register(authRoutes);
await app.register(tenantsRoutes);
await app.register(targetsRoutes);
await app.register(keywordsRoutes);
await app.register(mentionsRoutes);
await app.register(adminRoutes);

const port = Number(process.env["PORT"] ?? 3001);
await app.listen({ port, host: "0.0.0.0" });
console.log(`API running on http://0.0.0.0:${port}`);
