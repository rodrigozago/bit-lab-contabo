import { escapeHtml, layout } from "./base.js";

const APP_COPY = {
  "bordado-digital": {
    subject: "Você foi convidado pro teste alfa do Bordado Digital 🪡",
    heading: "Você foi convidado pro teste alfa do Bordado Digital",
    bodyHtml: `<p style="margin:0 0 8px;">Alguém te convidou pra participar do teste alfa do
      <strong>Bordado Digital</strong> — a ferramenta que transforma foto ou desenho em arquivo
      pronto pra máquina de bordar (DST, PES, JEF), direto do navegador.</p>
      <p style="margin:0 0 8px;">Durante o alfa, o acesso é <strong>100% gratuito</strong>, sem
      cartão de crédito.</p>
      <div style="background:#2a2140;border:1px solid #7c5cbf;border-radius:8px;padding:14px 16px;margin:0 0 8px;">
        <p style="margin:0;"><strong>🎁 Bônus:</strong> use o app e manda um feedback bom pelo
        botão de feedback (dentro do editor, logado) — um retorno específico, contando o que
        funcionou, o que travou e o que faltou, vale um parágrafo curto — e você ganha
        <strong>1 mês grátis do plano pago</strong> quando o Bordado Digital for lançado
        oficialmente.</p>
      </div>
      <p style="margin:0;">Clique no botão abaixo pra criar sua conta e começar.</p>`,
    ctaLabel: "Criar minha conta",
  },
};

const DEFAULT_COPY = {
  subject: "Você foi convidado para o bit-lab",
  heading: "Você foi convidado para o bit-lab",
  bodyHtml: `<p style="margin:0 0 8px;">Alguém te convidou pra criar uma conta e acessar um app do bit-lab.</p>
    <p style="margin:0;">Clique no botão abaixo pra criar sua conta.</p>`,
  ctaLabel: "Criar minha conta",
};

// data: { url, expiresAt, appSlug? } — appSlug escolhe o texto específico
// daquele app quando o convite dá acesso a um único app reconhecido (ver
// auth/src/routes/admin.js POST /api/signup-tokens); sem match, cai no texto
// genérico.
export function inviteTemplate(data) {
  const copy = (data.appSlug && APP_COPY[data.appSlug]) || DEFAULT_COPY;
  const expires = data.expiresAt
    ? new Date(data.expiresAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "long" })
    : null;

  const html = layout({
    title: copy.subject,
    heading: copy.heading,
    bodyHtml: copy.bodyHtml,
    ctaLabel: copy.ctaLabel,
    ctaUrl: data.url,
    footerNote: expires
      ? `Este link expira em ${escapeHtml(expires)}. Se você não esperava este e-mail, pode ignorá-lo.`
      : "Se você não esperava este e-mail, pode ignorá-lo.",
  });

  return { subject: copy.subject, html };
}
