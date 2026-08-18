// Versão do termo global (cadastro) — mudar este valor invalida os aceites
// antigos automaticamente (legal_acceptances é chaveada por versão), sem
// precisar apagar histórico. Formato livre, só precisa ser único por revisão
// do texto (ex.: data da revisão).
const GLOBAL_TERMS_VERSION = '2026-08-17'

// Termo PRÓPRIO do bordado-digital (gate no primeiro acesso àquele app
// específico, além do termo global do cadastro — ver bootstrapAdmin.js e
// routes/interaction.js). Reaproveita a mesma página /legal/termos por
// enquanto — trocar por um texto específico do app é só apontar
// apps.terms_url pra outra rota quando/se existir.
const BORDADO_DIGITAL_TERMS_VERSION = '2026-08-17'

module.exports = { GLOBAL_TERMS_VERSION, BORDADO_DIGITAL_TERMS_VERSION }
