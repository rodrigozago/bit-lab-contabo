import crypto from "crypto";
import { sendEmail } from "../resend.js";
import { inviteTemplate } from "../templates/invite.js";
import { passwordResetTemplate } from "../templates/passwordReset.js";
import { emailVerificationTemplate } from "../templates/emailVerification.js";
import { feedbackTemplate } from "../templates/feedback.js";

const TEMPLATES = {
  invite: inviteTemplate,
  "password-reset": passwordResetTemplate,
  "email-verification": emailVerificationTemplate,
  feedback: feedbackTemplate,
};

const INTERNAL_KEY = process.env.INTERNAL_KEY || "";

function timingSafeEqualStr(a, b) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export async function sendRoutes(app) {
  app.addHook("onRequest", (req, reply, done) => {
    const provided = req.headers["x-internal-key"];
    if (typeof provided !== "string" || !INTERNAL_KEY || !timingSafeEqualStr(provided, INTERNAL_KEY)) {
      return reply.status(401).send({ ok: false, error: "não autorizado" });
    }
    done();
  });

  app.post(
    "/send",
    {
      schema: {
        body: {
          type: "object",
          required: ["template", "to", "data"],
          properties: {
            template: { type: "string", enum: Object.keys(TEMPLATES) },
            to: { type: "string", format: "email" },
            data: { type: "object" },
          },
        },
      },
    },
    async (req, reply) => {
      const { template, to, data } = req.body;
      const build = TEMPLATES[template];
      const { subject, html } = build(data);
      try {
        const result = await sendEmail({ to, subject, html });
        return { ok: true, id: result.id };
      } catch (err) {
        req.log.error({ err, template }, "falha ao enviar e-mail");
        return reply.status(502).send({ ok: false, error: "falha ao enviar e-mail" });
      }
    }
  );
}
