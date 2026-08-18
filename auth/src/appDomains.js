// Domínio público de cada app — usado só pra variável {domain} no texto do
// e-mail de convite (ver routes/admin.js, templateVars.js). Não existe coluna
// pra isso no banco de propósito: é puramente cosmético pro texto do convite,
// não afeta OIDC/redirect (isso já vive nos redirect_uris de src/oidc.js).
// App sem entrada aqui cai no fallback 'bit-lab.tech' (ver templateVars.js).
const APP_DOMAINS = {
  'bordado-digital': 'bordado.digital',
  'face-lab': 'face.bit-lab.tech',
  'on-air': 'on-air.bit-lab.tech',
  'sentinela': 'sentinela.bit-lab.tech',
  'studio': 'studio.bit-lab.tech',
}

module.exports = { APP_DOMAINS }
