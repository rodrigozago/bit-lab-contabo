import type { FastifyInstance } from "fastify";
import { config } from "../config.js";
import { startAuth, finishAuth } from "../services/oidcClient.js";
import { createSession, destroySession, readSession } from "../services/session.js";

// caminhos locais apenas — o returnTo volta num redirect pós-login
function safeReturnTo(raw: unknown): string {
  const s = typeof raw === "string" ? raw : "";
  return s.startsWith("/") && !s.startsWith("//") ? s : "/";
}

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/auth/login", async (req, reply) => {
    const { returnTo } = req.query as { returnTo?: string };
    const { url } = await startAuth(safeReturnTo(returnTo));
    return reply.redirect(url);
  });

  app.get("/api/auth/callback", async (req, reply) => {
    const params = req.query as Record<string, string>;

    // auth negou (ex: conta sem acesso ainda — solicitação fica pendente pro
    // admin aprovar) — não existe sessão pra consultar nesse ponto, então o
    // "pendente" viaja como query param só pra essa primeira tentativa.
    if (params["error"]) {
      const status = params["error"] === "access_denied" ? "pending" : "error";
      return reply.redirect(`/?authStatus=${status}`);
    }

    const { sub, email, isAdmin, returnTo } = await finishAuth(params);
    // sem e-mail no log (PII) — sub já identifica o usuário se precisar cruzar
    req.log.info({ sub, isAdmin }, "login OIDC concluído");

    await createSession(reply, { sub, email, isAdmin });
    return reply.redirect(safeReturnTo(returnTo));
  });

  app.post("/api/auth/logout", async (req, reply) => {
    await destroySession(req, reply);
    // logout SSO: o front navega pra cá — o auth derruba bl_session + sessão
    // do provider e volta pro app (senão o próximo login entra sozinho)
    const ssoLogoutUrl = `${config.oidc.issuer}/logout?redirect=${encodeURIComponent(`${config.publicUrl}/`)}`;
    return { ok: true, data: { ssoLogoutUrl } };
  });

  app.get("/api/me", async (req, reply) => {
    const user = await readSession(req);
    if (!user) return reply.status(401).send({ ok: false, error: "não autenticado" });
    return { ok: true, data: user };
  });
}
