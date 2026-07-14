import { mkdir } from "fs/promises";
import { join } from "path";
import Fastify from "fastify";
import cookie from "@fastify/cookie";
import multipart from "@fastify/multipart";
import { config } from "./config.js";
import { migrate } from "./db.js";
import { startResultListener } from "./services/jobQueue.js";
import { authRoutes } from "./routes/auth.js";
import { googleRoutes } from "./routes/google.js";
import { albumRoutes } from "./routes/albums.js";
import { enrollmentRoutes } from "./routes/enrollment.js";
import { galleryRoutes } from "./routes/gallery.js";
import { mediaRoutes } from "./routes/media.js";
import { adminRoutes } from "./routes/admin.js";
import { notificationRoutes } from "./routes/notifications.js";
import { producerPageRoutes } from "./routes/producerPage.js";
import { publicRoutes } from "./routes/public.js";
import { runRetentionSweep } from "./services/retention.js";
import { rollbar, installConsoleForwarding } from "./services/rollbar.js";

async function main(): Promise<void> {
  // antes de tudo: logs de boot/migração também vão pro Rollbar
  installConsoleForwarding();

  await migrate();
  for (const dir of ["incoming", "thumbs", "thumbs-clean", "crops", "enroll"]) {
    await mkdir(join(config.mediaDir, dir), { recursive: true });
  }
  await startResultListener();

  // varredura de retenção: arquiva álbuns sem re-scan há RETENTION_DAYS. Sem
  // infra nova (sem cron container) — mesmo padrão de serviço de fundo simples
  // dentro do processo que já usamos pro listener de resultados do worker.
  setTimeout(() => void runRetentionSweep().catch((err) => console.error("[retention] sweep falhou:", err)), 30_000);
  setInterval(() => void runRetentionSweep().catch((err) => console.error("[retention] sweep falhou:", err)), 6 * 60 * 60 * 1000);

  const app = Fastify({ logger: true, trustProxy: true });

  await app.register(cookie, { secret: config.sessionSecret });
  await app.register(multipart, {
    limits: { fileSize: 5 * 1024 * 1024, files: 10 }, // frames de webcam ~640px
  });

  // POST sem body com content-type json (ex: logout) não deve dar 400 —
  // o parser padrão do Fastify rejeita body vazio
  app.addContentTypeParser("application/json", { parseAs: "string" }, (_req, body, done) => {
    const raw = typeof body === "string" ? body.trim() : "";
    if (raw === "") return done(null, {});
    try {
      done(null, JSON.parse(raw));
    } catch (err) {
      done(err as Error, undefined);
    }
  });

  app.setErrorHandler((err, req, reply) => {
    app.log.error(err);
    rollbar?.error(err, { method: req.method, url: req.url });
    const status = err.statusCode && err.statusCode >= 400 ? err.statusCode : 500;
    void reply.status(status).send({ ok: false, error: err.message ?? "erro interno" });
  });

  app.get("/health", async () => ({ ok: true, service: "face-lab-api" }));

  await app.register(authRoutes);
  await app.register(googleRoutes);
  await app.register(albumRoutes);
  await app.register(enrollmentRoutes);
  await app.register(galleryRoutes);
  await app.register(mediaRoutes);
  await app.register(adminRoutes);
  await app.register(notificationRoutes);
  await app.register(producerPageRoutes);
  await app.register(publicRoutes);

  await app.listen({ port: config.port, host: "0.0.0.0" });
  console.log(`face-lab-api rodando em http://0.0.0.0:${config.port}`);
}

main().catch((err) => {
  console.error("[api] falha ao iniciar:", err);
  process.exit(1);
});
