// Substituição literal de {var} no texto do e-mail de convite editado pelo
// admin (ver inviteTemplates.js pro texto padrão e routes/admin.js pra onde
// isso é chamado). Token sem valor correspondente vira string vazia — melhor
// que deixar "{var}" literal escapar num e-mail de verdade.
function renderVars(html, vars) {
  return html.replace(/\{(\w+)\}/g, (_, key) => (key in vars ? String(vars[key]) : ''))
}

module.exports = { renderVars }
