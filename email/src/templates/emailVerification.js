import { layout } from "./base.js";

// data: { url }
export function emailVerificationTemplate(data) {
  const html = layout({
    title: "Confirme seu e-mail — bit-lab",
    heading: "Confirme seu e-mail",
    bodyHtml: `<p style="margin:0 0 8px;">Falta só um passo pra ativar sua conta bit-lab.</p>
      <p style="margin:0;">Clique no botão abaixo pra confirmar que este e-mail é seu.</p>`,
    ctaLabel: "Confirmar meu e-mail",
    ctaUrl: data.url,
    footerNote: "Se você não criou uma conta no bit-lab, pode ignorar este e-mail.",
  });

  return { subject: "Confirme seu e-mail — bit-lab", html };
}
