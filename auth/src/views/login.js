function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]))
}

function layout(title, body) {
  return `<!doctype html>
<html lang="pt-br">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<style>
  body { font-family: system-ui, sans-serif; background: #0f0f10; color: #eee; display: flex;
         align-items: center; justify-content: center; height: 100vh; margin: 0; }
  form { background: #1a1a1c; padding: 32px; border-radius: 12px; width: 320px; }
  h1 { font-size: 18px; margin: 0 0 20px; }
  label { display: block; font-size: 13px; color: #aaa; margin-bottom: 4px; }
  input { width: 100%; padding: 10px; margin-bottom: 16px; border-radius: 6px; border: 1px solid #333;
          background: #0f0f10; color: #eee; box-sizing: border-box; }
  button { width: 100%; padding: 10px; border-radius: 6px; border: none; background: #7c5cbf;
           color: #fff; font-weight: 700; cursor: pointer; }
  .error { color: #e05252; font-size: 13px; margin-bottom: 12px; }
  .alt { font-size: 13px; color: #aaa; margin-top: 16px; text-align: center; }
  .alt a { color: #a98ee6; }
</style>
</head>
<body>
${body}
</body>
</html>`
}

// action customizável: o fluxo OIDC posta em /interaction/:uid/login em vez de /login
function renderLogin({ error, redirect, action = '/login', signupHref } = {}) {
  const safeRedirect = escapeHtml(redirect || '')
  return layout('bit-lab — login', `  <form method="POST" action="${escapeHtml(action)}">
    <h1>🪡 bit-lab — login</h1>
    ${error ? `<div class="error">${escapeHtml(error)}</div>` : ''}
    <input type="hidden" name="redirect" value="${safeRedirect}" />
    <label>E-mail</label>
    <input type="email" name="email" required autofocus />
    <label>Senha</label>
    <input type="password" name="password" required />
    <button type="submit">Entrar</button>
    ${signupHref ? `<div class="alt">Não tem conta? <a href="${escapeHtml(signupHref)}">Criar conta</a></div>` : ''}
  </form>`)
}

function renderSignup({ error, redirect } = {}) {
  const safeRedirect = escapeHtml(redirect || '')
  return layout('bit-lab — criar conta', `  <form method="POST" action="/signup">
    <h1>🪡 bit-lab — criar conta</h1>
    ${error ? `<div class="error">${escapeHtml(error)}</div>` : ''}
    <input type="hidden" name="redirect" value="${safeRedirect}" />
    <label>E-mail</label>
    <input type="email" name="email" required autofocus />
    <label>Senha (mín. 8 caracteres)</label>
    <input type="password" name="password" minlength="8" required />
    <label>Confirme a senha</label>
    <input type="password" name="password2" minlength="8" required />
    <button type="submit">Criar conta</button>
    <div class="alt">Já tem conta? <a href="/login${redirect ? `?redirect=${encodeURIComponent(redirect)}` : ''}">Entrar</a></div>
  </form>`)
}

module.exports = { renderLogin, renderSignup }
