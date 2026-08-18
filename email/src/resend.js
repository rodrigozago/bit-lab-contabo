import { Resend } from "resend";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || "bit-lab <onboarding@resend.dev>";

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

// Sem RESEND_API_KEY o serviço sobe (não trava o boot), mas todo envio falha
// alto — mais fácil de notar em dev/staging do que um no-op silencioso.
export async function sendEmail({ to, subject, html }) {
  if (!resend) {
    throw new Error("RESEND_API_KEY não configurada — e-mail não enviado.");
  }
  const { data, error } = await resend.emails.send({ from: EMAIL_FROM, to, subject, html });
  if (error) throw new Error(error.message || "falha ao enviar e-mail");
  return { id: data?.id };
}
