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

async function main(): Promise<void> {
  await migrate();
  for (const dir of ["incoming", "thumbs", "crops", "enroll"]) {
    await mkdir(join(config.mediaDir, dir), { recursive: true });
  }
  await startResultListener();

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

  app.setErrorHandler((err, _req, reply) => {
    app.log.error(err);
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

  await app.listen({ port: config.port, host: "0.0.0.0" });
  console.log(`face-lab-api rodando em http://0.0.0.0:${config.port}`);
}

main().catch((err) => {
  console.error("[api] falha ao iniciar:", err);
  process.exit(1);
});
