function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

// E-mail HTML precisa de estilo inline (clientes de e-mail ignoram <style>
// externo/em muitos casos até <style> no <head>) — mesma paleta escura/roxa
// de auth/src/views/login.js só pra manter identidade visual entre as telas
// de login e os e-mails transacionais.
function layout({ title, heading, bodyHtml, ctaLabel, ctaUrl, footerNote }) {
  const cta = ctaUrl
    ? `<tr><td style="padding:24px 0 8px;">
        <a href="${escapeHtml(ctaUrl)}"
           style="display:inline-block;background:#7c5cbf;color:#ffffff;font-weight:600;
                  text-decoration:none;padding:12px 24px;border-radius:8px;font-family:sans-serif;">
          ${escapeHtml(ctaLabel || 'Continuar')}
        </a>
      </td></tr>`
    : '';

  return `<!doctype html>
<html lang="pt-br">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:0;background:#141414;font-family:sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#141414;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="480" cellpadding="0" cellspacing="0"
             style="background:#1f1f1f;border:1px solid #333;border-radius:12px;padding:32px;max-width:480px;width:100%;">
        <tr><td style="font-size:20px;font-weight:600;color:#fafafa;padding-bottom:16px;">🪡 bit-lab</td></tr>
        <tr><td style="font-size:16px;font-weight:600;color:#fafafa;padding-bottom:12px;">${escapeHtml(heading)}</td></tr>
        <tr><td style="font-size:14px;line-height:1.6;color:#d4d4d4;">${bodyHtml}</td></tr>
        ${cta}
        ${footerNote ? `<tr><td style="font-size:12px;color:#a3a3a3;padding-top:24px;">${escapeHtml(footerNote)}</td></tr>` : ''}
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export { escapeHtml, layout };
