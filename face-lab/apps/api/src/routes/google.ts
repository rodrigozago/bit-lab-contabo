import type { FastifyInstance } from "fastify";
import { requireProducer } from "../guards.js";
import {
  googleConfigured,
  startGoogleConnect,
  finishGoogleConnect,
  getGoogleStatus,
  disconnectGoogle,
} from "../services/googleOAuth.js";

export async function googleRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/google/connect", async (req, reply) => {
    const user = await requireProducer(req, reply);
    if (!user) return;
    if (!googleConfigured()) {
      return reply.status(503).send({ ok: false, error: "integração Google não configurada (GOOGLE_CLIENT_ID/SECRET/TOKEN_ENC_KEY)" });
    }
    const url = await startGoogleConnect(user.id);
    return reply.redirect(url);
  });

  app.get("/api/google/callback", async (req, reply) => {
    const { code, state, error } = req.query as { code?: string; state?: string; error?: string };
    if (error || !code || !state) {
      return reply.redirect(`/producer?googleError=${encodeURIComponent(error ?? "callback inválido")}`);
    }
    try {
      await finishGoogleConnect(code, state);
      return reply.redirect("/producer");
    } catch (err) {
      return reply.redirect(`/producer?googleError=${encodeURIComponent(String((err as Error).message))}`);
    }
  });

  app.get("/api/google/status", async (req, reply) => {
    const user = await requireProducer(req, reply);
    if (!user) return;
    return { ok: true, data: await getGoogleStatus(user.id) };
  });

  app.delete("/api/google", async (req, reply) => {
    const user = await requireProducer(req, reply);
    if (!user) return;
    await disconnectGoogle(user.id);
    return { ok: true, data: null };
  });
}
