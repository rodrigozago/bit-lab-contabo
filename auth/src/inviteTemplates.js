// Texto padrão (editável) do corpo do e-mail de convite, por app — pré-carrega
// o editor rico no admin (GET /admin/api/invite-template, ver routes/admin.js)
// e serve de fallback se o admin não digitar nada. Variáveis literais
// {name}/{app}/{domain}/{url} são substituídas na hora de enviar
// (templateVars.js) — não mexer no NOME dessas chaves sem atualizar lá também.
const APP_INVITE_BODY = {
  'bordado-digital': `<p>Oi {name}, você foi convidado pra participar do teste alfa do <strong>{app}</strong> — a ferramenta que transforma foto ou desenho em arquivo pronto pra máquina de bordar (DST, PES, JEF), direto do navegador em {domain}.</p>
<p>Durante o alfa, o acesso é <strong>100% gratuito</strong>, sem cartão de crédito.</p>
<p>🎁 <strong>Bônus:</strong> use o app e manda um feedback bom pelo botão de feedback (dentro do editor, logado) — um retorno específico, contando o que funcionou, o que travou e o que faltou, vale um parágrafo curto — e você ganha <strong>1 mês grátis do plano pago</strong> quando o {app} for lançado oficialmente.</p>
<p>Clique no botão abaixo pra criar sua conta e começar.</p>`,
}

const DEFAULT_INVITE_BODY = `<p>Oi {name}, você foi convidado pra criar uma conta e acessar o {app} ({domain}).</p>
<p>Clique no botão abaixo pra criar sua conta.</p>`

function defaultInviteBody(appSlug) {
  return (appSlug && APP_INVITE_BODY[appSlug]) || DEFAULT_INVITE_BODY
}

module.exports = { defaultInviteBody }
