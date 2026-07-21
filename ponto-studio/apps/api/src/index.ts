import Fastify from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import multipart from "@fastify/multipart";
import staticFiles from "@fastify/static";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { projectsRoutes } from "./routes/projects.js";
import { hoopsRoutes } from "./routes/hoops.js";
import { exportRoutes } from "./routes/export.js";
import { uploadRoutes } from "./routes/upload.js";
import { analyzeRoutes } from "./routes/analyze.js";
import { previewRoutes } from "./routes/preview.js";
import { stitchPreviewRoutes } from "./routes/stitchPreview.js";
import { authRoutes } from "./routes/auth.js";
import { startResultListener } from "./services/jobQueue.js";
import { startCleanup } from "./services/cleanup.js";
import { migrate } from "./db.js";
import { config } from "./config.js";
import { readSession } from "./services/session.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// trustProxy: atrás do nginx da VPS — pro req.ip (usado no rate limit) ser o
// IP real do cliente, não o do proxy. Só o loopback é exposto, então confiar
// no proxy local é seguro.
const app = Fastify({ logger: { level: "info" }, trustProxy: true });

// Persistência de projetos depende do Postgres — diferente do Redis (que é
// opcional), aqui não faz sentido subir a API sem conseguir ler/gravar dados.
await migrate();

// CORS fixado na origem do app (não reflete qualquer Origin) — ver
// docs/SEGURANCA-PRE-LANCAMENTO.md item 4. Em dev, libera as portas locais
// do Vite/preview além do publicUrl.
const corsOrigins = config.isProd
  ? [config.publicUrl]
  : [config.publicUrl, /^http:\/\/localhost:\d+$/];
await app.register(cors, { origin: corsOrigins, credentials: true });
await app.register(cookie);

// Headers de segurança (docs/SEGURANCA-PRE-LANCAMENTO.md item 8). CSP fica
// DESLIGADA aqui: a SPA (tldraw) usa blob:/worker:/inline e a CSP certa é
// mais fácil de acertar no nginx que serve o front — o helmet aqui cobre os
// demais headers da API (nosniff, frame-ancestors via X-Frame-Options,
// Referrer-Policy, HSTS quando atrás de https). Ver item 8 do doc: confirmar
// no nginx se a CSP do front já existe.
await app.register(helmet, { contentSecurityPolicy: false });

// Rate limit global (freia abuso das rotas caras — análise/upload/export).
// docs/SEGURANCA-PRE-LANCAMENTO.md item 5. Chaveado por IP (atrás do nginx,
// o Fastify lê o X-Forwarded-For via trustProxy abaixo).
await app.register(rateLimit, {
  global: true,
  max: 120,
  timeWindow: "1 minute",
  allowList: (req) => req.url === "/health",
});

await app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } });

// Gate de sessão pros arquivos estáticos (exports = arquivos de bordado
// gerados; uploads = imagens do usuário). Os nomes são UUIDs, mas antes
// qualquer um com a URL baixava o arquivo — agora exige sessão. Ver
// docs/SEGURANCA-PRE-LANCAMENTO.md item 7. (Não amarra por dono ainda —
// os nomes UUID não são enumeráveis; amarrar arquivo→dono é fast-follow.)
app.addHook("onRequest", async (req, reply) => {
  if (req.url.startsWith("/exports/") || req.url.startsWith("/uploads/")) {
    const user = await readSession(req);
    if (!user) return reply.status(401).send({ ok: false, error: "não autenticado" });
  }
});

// Serve exports (arquivos de bordado gerados)
await app.register(staticFiles, {
  root: join(__dirname, "..", "exports"),
  prefix: "/exports/",
});

// Serve uploads (imagens enviadas pelos usuários)
await app.register(staticFiles, {
  root: join(__dirname, "..", "uploads"),
  prefix: "/uploads/",
  decorateReply: false,
});

await app.register(projectsRoutes, { prefix: "/api/projects" });
await app.register(hoopsRoutes, { prefix: "/api/hoops" });
await app.register(exportRoutes, { prefix: "/api/export" });
await app.register(uploadRoutes, { prefix: "/api/upload" });
await app.register(analyzeRoutes, { prefix: "/api/analyze" });
await app.register(previewRoutes, { prefix: "/api/preview" });
await app.register(stitchPreviewRoutes, { prefix: "/api/stitch-preview" });
await app.register(authRoutes);

app.get("/health", async () => ({ ok: true, service: "ponto-studio-api" }));

// INF-4: limpeza periódica de arquivos antigos em exports/ e uploads/
startCleanup(
  { exportsDir: join(__dirname, "..", "exports"), uploadsDir: join(__dirname, "..", "uploads") },
  app.log
);

// Inicia listener de resultados do worker via Redis pub/sub.
// Sem Redis a API sobe mesmo assim — apenas a exportação para formatos
// de máquina (DST/PES/JEF) fica indisponível; a exportação SVG é síncrona.
try {
  await startResultListener();
} catch (err) {
  app.log.warn(
    { err },
    "Redis indisponível — exportação DST/PES/JEF desabilitada (SVG continua funcionando)"
  );
}

const port = Number(process.env["PORT"] ?? 3001);
await app.listen({ port, host: "0.0.0.0" });
console.log(`API running on http://0.0.0.0:${port}`);
