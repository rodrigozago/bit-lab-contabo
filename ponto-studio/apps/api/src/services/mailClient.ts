import { config } from "../config.js";
import { getRollbar } from "./rollbar.js";

/**
 * Cliente fino do microserviço email/ (mail.bit-lab.tech) — mesmo padrão do
 * auth/src/mailClient.js. Falha no envio não deve quebrar a requisição que
 * chamou: loga no Rollbar e devolve `ok: false` pro caller decidir o que
 * mostrar (ver routes/feedback.ts).
 */
export async function sendFeedback(data: {
  message: string;
  appName: string;
  account: { email: string };
  location: { city?: string; region?: string; country?: string } | null;
  browser: { userAgent?: string; language?: string; timezone?: string; viewport?: string };
  ip: string;
  to: string;
}): Promise<{ ok: boolean }> {
  const { serviceUrl, internalKey } = config.mail;
  if (!serviceUrl || !internalKey) {
    console.warn("[mailClient] MAIL_SERVICE_URL/MAIL_INTERNAL_KEY não configurados — feedback não enviado por e-mail.");
    return { ok: false };
  }

  try {
    const res = await fetch(`${serviceUrl}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Internal-Key": internalKey },
      body: JSON.stringify({ template: "feedback", to: data.to, data }),
    });
    if (!res.ok) {
      throw new Error(`email service respondeu ${res.status}`);
    }
    return { ok: true };
  } catch (err) {
    console.error("[mailClient] falha ao enviar feedback:", err);
    getRollbar()?.error(err as Error);
    return { ok: false };
  }
}
