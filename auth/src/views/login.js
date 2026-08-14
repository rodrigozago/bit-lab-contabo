function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]))
}

// Paleta neutra (aprox. dos tokens OKLCH do shadcn/ui "neutral", modo escuro)
// + Inter — só pra não destoar visualmente da SPA nova em apps.bit-lab.tech.
// Continua HTML/CSS puro (essas telas não fazem parte da SPA, ver plano).
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
         align-items: center; justify-content: center; height: 100vh; margin: 0; }
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

// token = resgate de convite (e-mail travado se o convite tiver um);
// app = self-signup clássico daquele app específico.
//
// "Já tenho conta" pra quem veio de um convite (token) não vai só pro /login
// — vai pro /invite/redeem, que loga normalmente e DEPOIS resgata o convite
// pra essa conta já existente (senão o acesso concedido pelo link se perderia).
function renderSignup({ error, redirect, token, app, lockedEmail, name, instagram, whatsapp } = {}) {
  const safeRedirect = escapeHtml(redirect || '')
  const hasAccountHref = token
    ? `/invite/redeem?token=${encodeURIComponent(token)}${redirect ? `&redirect=${encodeURIComponent(redirect)}` : ''}`
    : `/login${redirect ? `?redirect=${encodeURIComponent(redirect)}` : ''}`

  return layout('bit-lab — criar conta', `  <div style="display:flex;flex-direction:column;gap:16px;">
    <div class="card">
      <h1>🪡 Crie sua conta bit-lab</h1>
      <p>Você foi convidado pro bit-lab. Se já tem uma conta, é só entrar — o convite continua valendo.</p>
      <a class="btn-secondary" href="${escapeHtml(hasAccountHref)}">Já tenho conta</a>
    </div>
    <form method="POST" action="/signup">
      ${error ? `<div class="error">${escapeHtml(error)}</div>` : ''}
      <input type="hidden" name="redirect" value="${safeRedirect}" />
      ${token ? `<input type="hidden" name="token" value="${escapeHtml(token)}" />` : ''}
      ${app ? `<input type="hidden" name="app" value="${escapeHtml(app)}" />` : ''}
      <label>Nome</label>
      <input type="text" name="name" required ${lockedEmail ? '' : 'autofocus'}
             value="${escapeHtml(name || '')}" />
      <label>E-mail</label>
      <input type="email" name="email" required
             ${lockedEmail ? `value="${escapeHtml(lockedEmail)}" readonly` : ''} />
      <label>Senha (mín. 8 caracteres)</label>
      <input type="password" name="password" minlength="8" required />
      <label>Confirme a senha</label>
      <input type="password" name="password2" minlength="8" required />
      <label>Instagram</label>
      <input type="text" name="instagram" placeholder="@seuusuario" required
             value="${escapeHtml(instagram || '')}" />
      <label>WhatsApp</label>
      <input type="text" name="whatsapp" placeholder="(00) 00000-0000" required
             value="${escapeHtml(whatsapp || '')}" />
      <button type="submit">Criar conta</button>
    </form>
  </div>`)
}

// Tela de mensagem simples (ex: convite inválido/expirado) — sem form.
function renderMessage({ title, message }) {
  return layout(`bit-lab — ${title}`, `  <div class="card">
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(message)}</p>
  </div>`)
}

module.exports = { renderLogin, renderSignup, renderMessage }
