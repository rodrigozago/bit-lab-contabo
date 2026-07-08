import type { FastifyInstance } from "fastify";
import type { Me } from "@face-lab/shared";
import { pool } from "../db.js";
import { config } from "../config.js";
import { startAuth, finishAuth } from "../services/oidcClient.js";
import { createSession, destroySession, readSession } from "../services/session.js";
import { getGoogleStatus } from "../services/googleOAuth.js";

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

    // auth negou (ex: conta sem acesso ao app) — volta pra landing com o motivo
    if (params["error"]) {
      const msg = params["error_description"] ?? params["error"];
      return reply.redirect(`/?authError=${encodeURIComponent(msg ?? "acesso negado")}`);
    }

    const { sub, email, isAdmin, returnTo } = await finishAuth(params);
    req.log.info({ sub, email, isAdmin }, "login OIDC concluído");

    // upsert por sub; espelha is_admin do auth nos dois sentidos a cada login:
    // ganhou is_admin lá → admin aqui; perdeu → cai pra guest (producer local não é afetado)
    const { rows } = await pool.query(
      `INSERT INTO users (oidc_sub, email, role)
       VALUES ($1, $2, CASE WHEN $3 THEN 'admin'::user_role ELSE 'guest'::user_role END)
       ON CONFLICT (oidc_sub) DO UPDATE
         SET email = EXCLUDED.email,
             role = CASE
               WHEN $3 THEN 'admin'::user_role
               WHEN users.role = 'admin' THEN 'guest'::user_role
               ELSE users.role
             END
       RETURNING id`,
      [sub, email, isAdmin]
    );

    await createSession(reply, rows[0].id);
    return reply.redirect(safeReturnTo(returnTo));
  });

  app.post("/api/auth/logout", async (req, reply) => {
    await destroySession(req, reply);
    // logout SSO: o front navega pra cá — o auth derruba bl_session + sessão
    // do provider e volta pra landing (senão o próximo login entra sozinho)
    const ssoLogoutUrl = `${config.oidc.issuer}/logout?redirect=${encodeURIComponent(`${config.publicUrl}/`)}`;
    return { ok: true, data: { ssoLogoutUrl } };
  });

  app.get("/api/me", async (req, reply) => {
    const user = await readSession(req);
    if (!user) return reply.status(401).send({ ok: false, error: "não autenticado" });

    const [enrollment, google] = await Promise.all([
      pool.query(
        `SELECT status FROM enrollments WHERE user_id = $1 AND active ORDER BY created_at DESC LIMIT 1`,
        [user.id]
      ),
      getGoogleStatus(user.id),
    ]);

    const me: Me = {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      hasEnrollment: enrollment.rows[0]?.status === "done",
      enrollmentStatus: enrollment.rows[0]?.status ?? null,
      googleConnected: google.connected,
    };
    return { ok: true, data: me };
  });
}
