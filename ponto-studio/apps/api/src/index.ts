import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import staticFiles from "@fastify/static";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { projectsRoutes } from "./routes/projects.js";
import { exportRoutes } from "./routes/export.js";
import { uploadRoutes } from "./routes/upload.js";
import { analyzeRoutes } from "./routes/analyze.js";
import { startResultListener } from "./services/jobQueue.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = Fastify({ logger: { level: "info" } });

await app.register(cors, { origin: true });
await app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } });

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
await app.register(exportRoutes, { prefix: "/api/export" });
await app.register(uploadRoutes, { prefix: "/api/upload" });
await app.register(analyzeRoutes, { prefix: "/api/analyze" });

app.get("/health", async () => ({ ok: true, service: "ponto-studio-api" }));

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
