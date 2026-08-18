import { escapeHtml, layout } from "./base.js";

function row(label, value) {
  if (!value) return "";
  return `<p style="margin:0 0 4px;"><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</p>`;
}

// data: { message, appName, account: { email }, location: { city, region, country } | null,
//         browser: { userAgent, language, timezone, viewport, platform }, ip }
export function feedbackTemplate(data) {
  const loc = data.location
    ? [data.location.city, data.location.region, data.location.country].filter(Boolean).join(", ")
    : "não identificada";

  const html = layout({
    title: `Novo feedback — ${data.appName || "bit-lab"}`,
    heading: `Novo feedback recebido (${data.appName || "bit-lab"})`,
    bodyHtml: `
      <div style="background:#141414;border:1px solid #333;border-radius:8px;padding:16px;margin:0 0 16px;white-space:pre-wrap;">
        ${escapeHtml(data.message)}
      </div>
      ${row("Conta", data.account?.email)}
      ${row("Localização (por IP)", loc)}
      ${row("IP", data.ip)}
      ${row("Navegador", data.browser?.userAgent)}
      ${row("Idioma", data.browser?.language)}
      ${row("Fuso horário", data.browser?.timezone)}
      ${row("Viewport", data.browser?.viewport)}
    `,
  });

  return { subject: `Novo feedback — ${data.appName || "bit-lab"}`, html };
}
