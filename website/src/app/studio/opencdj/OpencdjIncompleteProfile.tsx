/** Sessão existe, mas a conta foi criada antes de instagram/whatsapp virarem
 * obrigatórios (ou por outro caminho que não passa pelo signup, ex. admin
 * panel) — sem esses dados não tem o que pré-preencher no formulário. Manda
 * completar o perfil antes de tentar de novo — e, como a sessão do studio
 * guarda uma cópia desses dados de quando logou (não se atualiza sozinha
 * quando o perfil muda em outro lugar), também oferece um link que limpa
 * essa cópia e refaz o login, já de volta pro /opencdj. */
export function OpencdjIncompleteProfile() {
  const refreshUrl = `/auth/logout?returnTo=${encodeURIComponent(
    `/auth/login?returnTo=${encodeURIComponent("/opencdj")}`,
  )}`;

  return (
    <div className="opencdj-page">
      <section className="hero" style={{ minHeight: "100vh" }}>
        <div className="heroBg" />
        <div className="heroContent">
          <div className="heroBadge">[ FREQUÊNCIA RESTRITA // ORDEM OCULTA ]</div>
          <h1 className="headline" style={{ marginTop: "1rem" }}>
            Complete seu perfil
          </h1>
          <p className="description" style={{ maxWidth: "32rem", textAlign: "center" }}>
            Falta Instagram e/ou WhatsApp no seu cadastro bit-lab. Preenche isso no seu perfil —
            depois de salvar, usa o botão &ldquo;atualizar sessão&rdquo; aqui embaixo (só
            recarregar a página não basta).
          </p>
          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", justifyContent: "center" }}>
            <a href="https://apps.bit-lab.tech/profile" className="heroCta">
              <span className="ctaArrow">▶</span> IR PRO PERFIL
            </a>
            <a href={refreshUrl} className="heroCta">
              <span className="ctaArrow">▶</span> JÁ PREENCHI, ATUALIZAR SESSÃO
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
