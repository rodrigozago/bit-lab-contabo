const { escapeHtml, layout } = require('./layout')

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
    <div class="alt"><a href="/forgot-password${redirect ? `?redirect=${encodeURIComponent(redirect)}` : ''}">Esqueci minha senha</a></div>
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
      <label style="display:flex;align-items:flex-start;gap:8px;margin-bottom:16px;">
        <input type="checkbox" name="acceptTerms" required style="width:auto;margin:4px 0 0;" />
        <span style="font-size:13px;color:#a3a3a3;">Li e aceito os <a href="/legal/termos" target="_blank" rel="noopener" style="color:#b8a3e8;">Termos de Uso</a>
        e a <a href="/legal/privacidade" target="_blank" rel="noopener" style="color:#b8a3e8;">Política de Privacidade</a>.</span>
      </label>
      <button type="submit">Criar conta</button>
    </form>
  </div>`)
}

// Tela de mensagem simples (ex: convite inválido/expirado, e-mail verificado
// com sucesso) — sem form.
function renderMessage({ title, message }) {
  return layout(`bit-lab — ${title}`, `  <div class="card">
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(message)}</p>
  </div>`)
}

// Tela mostrada no meio do fluxo OIDC (prompt "consent") quando a conta
// ainda não confirmou o e-mail — ver routes/interaction.js. "Já confirmei"
// só recarrega /interaction/:uid (GET) — como a checagem de email_verified
// roda de novo a cada carregamento dessa rota, isso é o suficiente pra
// destravar assim que o usuário clicar no link do e-mail (a interação
// segue "pendurada", nunca finalizada até isso acontecer).
function renderVerifyPending({ uid, resent } = {}) {
  return layout('bit-lab — confirme seu e-mail', `  <div style="display:flex;flex-direction:column;gap:16px;">
    <div class="card">
      <h1>Confirme seu e-mail</h1>
      <p>Antes de continuar, você precisa confirmar seu e-mail — mandamos um
      link quando você criou a conta.</p>
      <p>Depois de clicar no link do e-mail, volte aqui e clique em
      "Já confirmei".</p>
      ${resent ? '<p style="color:#a3e8b8;">Reenviamos o e-mail de confirmação.</p>' : ''}
    </div>
    <a class="btn-secondary" href="/interaction/${escapeHtml(uid)}" style="text-align:center;">Já confirmei</a>
    <form method="POST" action="/interaction/${escapeHtml(uid)}/resend-verification">
      <button type="submit">Reenviar e-mail de confirmação</button>
    </form>
  </div>`)
}

function renderForgotPassword({ error, sent, redirect } = {}) {
  if (sent) {
    return layout('bit-lab — verifique seu e-mail', `  <div class="card">
      <h1>Verifique seu e-mail</h1>
      <p>Se existe uma conta com esse e-mail, mandamos um link pra redefinir a senha. O link expira em 1 hora.</p>
      <a class="btn-secondary" href="/login">Voltar pro login</a>
    </div>`)
  }
  const safeRedirect = escapeHtml(redirect || '')
  return layout('bit-lab — esqueci minha senha', `  <form method="POST" action="/forgot-password">
    <h1>🪡 Esqueci minha senha</h1>
    ${error ? `<div class="error">${escapeHtml(error)}</div>` : ''}
    <input type="hidden" name="redirect" value="${safeRedirect}" />
    <label>E-mail</label>
    <input type="email" name="email" required autofocus />
    <button type="submit">Enviar link de redefinição</button>
    <div class="alt"><a href="/login">Voltar pro login</a></div>
  </form>`)
}

function renderResetPassword({ error, token, redirect } = {}) {
  const safeRedirect = escapeHtml(redirect || '')
  return layout('bit-lab — nova senha', `  <form method="POST" action="/reset-password">
    <h1>🪡 Escolha uma nova senha</h1>
    ${error ? `<div class="error">${escapeHtml(error)}</div>` : ''}
    <input type="hidden" name="token" value="${escapeHtml(token)}" />
    <input type="hidden" name="redirect" value="${safeRedirect}" />
    <label>Nova senha (mín. 8 caracteres)</label>
    <input type="password" name="password" minlength="8" required autofocus />
    <label>Confirme a nova senha</label>
    <input type="password" name="password2" minlength="8" required />
    <button type="submit">Salvar nova senha</button>
  </form>`)
}

module.exports = { renderLogin, renderSignup, renderMessage, renderVerifyPending, renderForgotPassword, renderResetPassword }
