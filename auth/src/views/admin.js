function renderAdmin({ email }) {
  return `<!doctype html>
<html lang="pt-br">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>bit-lab — admin</title>
<style>
  body { font-family: system-ui, sans-serif; background: #0f0f10; color: #eee; margin: 0; padding: 24px; }
  header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
  h1 { font-size: 20px; margin: 0; }
  h2 { font-size: 15px; color: #aaa; text-transform: uppercase; letter-spacing: 0.05em; margin: 32px 0 12px; }
  section { background: #1a1a1c; border-radius: 12px; padding: 20px; margin-bottom: 8px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { text-align: left; padding: 8px 6px; border-bottom: 1px solid #2a2a2c; }
  th { color: #888; font-weight: 600; }
  form.inline { display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap; }
  input, select { padding: 8px; border-radius: 6px; border: 1px solid #333; background: #0f0f10; color: #eee; }
  button { padding: 8px 14px; border-radius: 6px; border: none; background: #7c5cbf; color: #fff;
           font-weight: 600; cursor: pointer; font-size: 13px; }
  button.danger { background: #8a2f2f; }
  button.ghost { background: transparent; border: 1px solid #444; }
  .msg { font-size: 13px; margin-top: 8px; min-height: 16px; }
  .msg.error { color: #e05252; }
  .msg.ok { color: #4caf7d; }
  a.logout { color: #aaa; font-size: 13px; }
</style>
</head>
<body>
<header>
  <h1>🪡 bit-lab — admin</h1>
  <div>
    <span style="color:#888;font-size:13px;margin-right:12px;">${email}</span>
    <a class="logout" href="#" onclick="logout()">sair</a>
  </div>
</header>

<section>
  <h2 style="margin-top:0">Solicitações pendentes</h2>
  <table id="requests-table"><thead><tr><th>Usuário</th><th>App</th><th>Solicitado em</th><th></th></tr></thead><tbody></tbody></table>
  <div class="msg" id="requests-msg"></div>
</section>

<section>
  <h2>Usuários</h2>
  <table id="users-table"><thead><tr><th>E-mail</th><th>Admin</th><th>Criado em</th><th></th></tr></thead><tbody></tbody></table>
  <form class="inline" onsubmit="createUser(event)">
    <input type="email" id="new-user-email" placeholder="email@bit-lab.tech" required />
    <input type="text" id="new-user-password" placeholder="senha" required />
    <label style="display:flex;align-items:center;gap:4px;font-size:13px;color:#aaa;">
      <input type="checkbox" id="new-user-admin" style="width:auto;" /> admin
    </label>
    <button type="submit">Criar usuário</button>
  </form>
  <div class="msg" id="users-msg"></div>
</section>

<section>
  <h2>Apps</h2>
  <table id="apps-table"><thead><tr><th>Slug</th><th>Nome</th><th></th></tr></thead><tbody></tbody></table>
  <form class="inline" onsubmit="createApp(event)">
    <input type="text" id="new-app-slug" placeholder="slug (ex: studio)" required />
    <input type="text" id="new-app-name" placeholder="Nome" required />
    <button type="submit">Criar app</button>
  </form>
  <div class="msg" id="apps-msg"></div>
</section>

<section>
  <h2>Acessos</h2>
  <table id="access-table"><thead><tr><th>Usuário</th><th>App</th><th></th></tr></thead><tbody></tbody></table>
  <form class="inline" onsubmit="createAccess(event)">
    <select id="access-user"></select>
    <select id="access-app"></select>
    <button type="submit">Conceder acesso</button>
  </form>
  <div class="msg" id="access-msg"></div>
</section>

<script>
let usersCache = []
let appsCache = []

async function api(path, opts) {
  const res = await fetch(path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(opts && opts.headers) },
  })
  if (res.status === 401) { window.location.href = '/login'; throw new Error('não autenticado') }
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error || 'erro')
  return body
}

function fmtDate(iso) { return new Date(iso).toLocaleDateString('pt-BR') }

async function loadAll() {
  usersCache = await api('/admin/api/users')
  appsCache = await api('/admin/api/apps')
  const access = await api('/admin/api/access')
  const requests = await api('/admin/api/access-requests')
  renderUsers()
  renderApps()
  renderAccess(access)
  renderRequests(requests)
  renderSelects()
}

function renderRequests(requests) {
  const tbody = document.querySelector('#requests-table tbody')
  if (requests.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="color:#888;">Nenhuma solicitação pendente.</td></tr>'
    return
  }
  tbody.innerHTML = requests.map(r => \`
    <tr>
      <td>\${r.email}</td>
      <td>\${r.name}</td>
      <td>\${fmtDate(r.requested_at)}</td>
      <td>
        <button onclick="decideRequest('\${r.id}', 'approve')">aprovar</button>
        <button class="danger" onclick="decideRequest('\${r.id}', 'reject')">recusar</button>
      </td>
    </tr>\`).join('')
}

async function decideRequest(id, action) {
  try {
    await api('/admin/api/access-requests/' + id + '/' + action, { method: 'POST' })
    showMsg('requests-msg', action === 'approve' ? 'Acesso concedido.' : 'Solicitação recusada.', true)
    await loadAll()
  } catch (err) { showMsg('requests-msg', err.message, false) }
}

function renderUsers() {
  const tbody = document.querySelector('#users-table tbody')
  tbody.innerHTML = usersCache.map(u => \`
    <tr>
      <td>\${u.email}</td>
      <td>\${u.is_admin ? 'sim' : '—'}</td>
      <td>\${fmtDate(u.created_at)}</td>
      <td>
        <button class="ghost" onclick="resetPassword('\${u.id}')">resetar senha</button>
        <button class="danger" onclick="deleteUser('\${u.id}')">remover</button>
      </td>
    </tr>\`).join('')
}

function renderApps() {
  const tbody = document.querySelector('#apps-table tbody')
  tbody.innerHTML = appsCache.map(a => \`
    <tr>
      <td>\${a.slug}</td>
      <td>\${a.name}</td>
      <td><button class="danger" onclick="deleteApp('\${a.id}')">remover</button></td>
    </tr>\`).join('')
}

function renderAccess(access) {
  const tbody = document.querySelector('#access-table tbody')
  tbody.innerHTML = access.map(a => \`
    <tr>
      <td>\${a.email}</td>
      <td>\${a.name}</td>
      <td><button class="danger" onclick="revokeAccess('\${a.user_id}','\${a.app_id}')">revogar</button></td>
    </tr>\`).join('')
}

function renderSelects() {
  document.querySelector('#access-user').innerHTML =
    usersCache.map(u => \`<option value="\${u.id}">\${u.email}</option>\`).join('')
  document.querySelector('#access-app').innerHTML =
    appsCache.map(a => \`<option value="\${a.id}">\${a.name}</option>\`).join('')
}

function showMsg(id, text, ok) {
  const el = document.querySelector('#' + id)
  el.textContent = text
  el.className = 'msg ' + (ok ? 'ok' : 'error')
  setTimeout(() => { el.textContent = ''; el.className = 'msg' }, 4000)
}

async function createUser(e) {
  e.preventDefault()
  const email = document.querySelector('#new-user-email').value
  const password = document.querySelector('#new-user-password').value
  const isAdmin = document.querySelector('#new-user-admin').checked
  try {
    await api('/admin/api/users', { method: 'POST', body: JSON.stringify({ email, password, isAdmin }) })
    e.target.reset()
    showMsg('users-msg', 'Usuário criado.', true)
    await loadAll()
  } catch (err) { showMsg('users-msg', err.message, false) }
}

async function resetPassword(id) {
  const password = prompt('Nova senha:')
  if (!password) return
  try {
    await api('/admin/api/users/' + id + '/reset-password', { method: 'POST', body: JSON.stringify({ password }) })
    showMsg('users-msg', 'Senha atualizada.', true)
  } catch (err) { showMsg('users-msg', err.message, false) }
}

async function deleteUser(id) {
  if (!confirm('Remover este usuário?')) return
  try {
    await api('/admin/api/users/' + id, { method: 'DELETE' })
    await loadAll()
  } catch (err) { showMsg('users-msg', err.message, false) }
}

async function createApp(e) {
  e.preventDefault()
  const slug = document.querySelector('#new-app-slug').value
  const name = document.querySelector('#new-app-name').value
  try {
    await api('/admin/api/apps', { method: 'POST', body: JSON.stringify({ slug, name }) })
    e.target.reset()
    showMsg('apps-msg', 'App criado.', true)
    await loadAll()
  } catch (err) { showMsg('apps-msg', err.message, false) }
}

async function deleteApp(id) {
  if (!confirm('Remover este app? Isso também remove os acessos concedidos a ele.')) return
  try {
    await api('/admin/api/apps/' + id, { method: 'DELETE' })
    await loadAll()
  } catch (err) { showMsg('apps-msg', err.message, false) }
}

async function createAccess(e) {
  e.preventDefault()
  const userId = document.querySelector('#access-user').value
  const appId = document.querySelector('#access-app').value
  try {
    await api('/admin/api/access', { method: 'POST', body: JSON.stringify({ userId, appId }) })
    showMsg('access-msg', 'Acesso concedido.', true)
    await loadAll()
  } catch (err) { showMsg('access-msg', err.message, false) }
}

async function revokeAccess(userId, appId) {
  try {
    await api('/admin/api/access/' + userId + '/' + appId, { method: 'DELETE' })
    await loadAll()
  } catch (err) { showMsg('access-msg', err.message, false) }
}

async function logout() {
  await fetch('/logout', { method: 'POST' })
  window.location.href = '/login'
}

loadAll()
</script>
</body>
</html>`
}

module.exports = { renderAdmin }
