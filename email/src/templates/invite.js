import { escapeHtml, layout } from "./base.js";

// data: { url, expiresAt }
export function inviteTemplate(data) {
  const expires = data.expiresAt
    ? new Date(data.expiresAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "long" })
    : null;

  const html = layout({
    title: "Convite bit-lab",
    heading: "Você foi convidado para o bit-lab",
    bodyHtml: `<p style="margin:0 0 8px;">Alguém te convidou pra criar uma conta e acessar um app do bit-lab.</p>
      <p style="margin:0;">Clique no botão abaixo pra criar sua conta.</p>`,
    ctaLabel: "Criar minha conta",
    ctaUrl: data.url,
    footerNote: expires
      ? `Este link expira em ${escapeHtml(expires)}. Se você não esperava este e-mail, pode ignorá-lo.`
      : "Se você não esperava este e-mail, pode ignorá-lo.",
  });

  return { subject: "Você foi convidado para o bit-lab", html };
}
