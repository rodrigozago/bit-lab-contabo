function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]))
}

// Paleta neutra (aprox. dos tokens OKLCH do shadcn/ui "neutral", modo escuro)
// + Inter — só pra não destoar visualmente da SPA nova em apps.bit-lab.tech.
// Continua HTML/CSS puro (essas telas não fazem parte da SPA).
function layout(title, body) {
  return `<!doctype html>
<html lang="pt-br">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<style>
  :root { color-scheme: dark; }
  body { font-family: 'Inter', system-ui, sans-serif; background: #141414; color: #fafafa; display: flex;
         align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 24px; box-sizing: border-box; }
  form, .card { background: #1f1f1f; border: 1px solid #333; padding: 32px; border-radius: 12px; width: 320px; }
  h1 { font-size: 18px; margin: 0 0 20px; font-weight: 600; }
  label { display: block; font-size: 13px; color: #a3a3a3; margin-bottom: 4px; }
  input { width: 100%; padding: 10px; margin-bottom: 16px; border-radius: 8px; border: 1px solid #3a3a3a;
          background: #141414; color: #fafafa; box-sizing: border-box; font: inherit; }
  input:read-only { opacity: 0.7; }
  button { width: 100%; padding: 10px; border-radius: 8px; border: none; background: #7c5cbf;
           color: #fff; font-weight: 600; cursor: pointer; font: inherit; }
  .error { color: #f87171; font-size: 13px; margin-bottom: 12px; }
  .alt { font-size: 13px; color: #a3a3a3; margin-top: 16px; text-align: center; }
  .alt a { color: #b8a3e8; }
  .card p { font-size: 14px; line-height: 1.5; color: #d4d4d4; margin: 0 0 12px; }
  .btn-secondary { display: block; text-align: center; padding: 10px; border-radius: 8px;
                   background: #333; color: #fff; text-decoration: none; font-weight: 600; }
</style>
</head>
<body>
${body}
</body>
</html>`
}

module.exports = { escapeHtml, layout }
