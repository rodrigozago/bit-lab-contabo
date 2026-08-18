const { escapeHtml, layout } = require('./layout')

// PLACEHOLDER — este texto não tem validade jurídica nenhuma, é só estrutura
// pra você (ou seu jurídico) substituir antes do go-live real. Não escrevi
// cláusulas de verdade aqui de propósito.
function renderTerms() {
  return layout('bit-lab — Termos de Uso', `  <div class="card" style="width:640px;max-width:90vw;text-align:left;">
    <h1>Termos de Uso</h1>
    <p><strong>[PENDENTE: revisão jurídica]</strong> — este texto é um
    placeholder e precisa ser substituído pelo conteúdo real antes do
    lançamento pra qualquer público além de teste interno.</p>
    <p>Aqui entram as regras de uso da plataforma bit-lab e dos apps
    associados (ex.: bordado.digital): o que é permitido, responsabilidades
    do usuário, limitações de responsabilidade, condições de cancelamento
    de conta, etc.</p>
    <p>Última atualização: 2026-08-17.</p>
  </div>`)
}

function renderPrivacy() {
  return layout('bit-lab — Política de Privacidade', `  <div class="card" style="width:640px;max-width:90vw;text-align:left;">
    <h1>Política de Privacidade</h1>
    <p><strong>[PENDENTE: revisão jurídica]</strong> — este texto é um
    placeholder e precisa ser substituído pelo conteúdo real antes do
    lançamento pra qualquer público além de teste interno.</p>
    <p>Aqui entram quais dados são coletados (e-mail, nome, Instagram,
    WhatsApp, avatar, projetos salvos), como são usados, com quem são
    compartilhados (se com alguém), por quanto tempo são retidos, e como o
    usuário pode pedir exclusão — conforme a LGPD.</p>
    <p>Última atualização: 2026-08-17.</p>
  </div>`)
}

// Tela de aceite do termo PRÓPRIO de um app (ver apps.terms_version) — só
// aparece no primeiro acesso daquele app específico, depois do login normal
// e da checagem de e-mail verificado. POST vai pra /interaction/:uid/terms.
function renderAppTerms({ uid, appName, termsUrl }) {
  return layout(`bit-lab — termos do ${appName}`, `  <form method="POST" action="/interaction/${escapeHtml(uid)}/terms">
    <h1>🪡 Só mais um passo</h1>
    <p>Antes de continuar pro <strong>${escapeHtml(appName)}</strong>,
    você precisa aceitar os termos específicos desse app.</p>
    <label style="display:flex;align-items:flex-start;gap:8px;margin-bottom:16px;">
      <input type="checkbox" name="accept" required style="width:auto;margin:4px 0 0;" />
      <span>Li e aceito os <a href="${escapeHtml(termsUrl)}" target="_blank" rel="noopener">termos do ${escapeHtml(appName)}</a>.</span>
    </label>
    <button type="submit">Continuar</button>
  </form>`)
}

module.exports = { renderTerms, renderPrivacy, renderAppTerms }
