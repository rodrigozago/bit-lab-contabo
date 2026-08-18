import { layout } from "./base.js";

// data: { url }
export function passwordResetTemplate(data) {
  const html = layout({
    title: "Redefinir senha — bit-lab",
    heading: "Redefinir sua senha",
    bodyHtml: `<p style="margin:0 0 8px;">Pediram a redefinição da senha da sua conta bit-lab.</p>
      <p style="margin:0;">Se não foi você, ignore este e-mail — sua senha continua a mesma.</p>`,
    ctaLabel: "Escolher nova senha",
    ctaUrl: data.url,
    footerNote: "Este link expira em 1 hora e só pode ser usado uma vez.",
  });

  return { subject: "Redefinir sua senha — bit-lab", html };
}
