/** Sessão existe, mas a conta foi criada antes de instagram/whatsapp virarem
 * obrigatórios (ou por outro caminho que não passa pelo signup, ex. admin
 * panel) — sem esses dados não tem o que pré-preencher no formulário. Manda
 * completar o perfil antes de tentar de novo. */
export function OpencdjIncompleteProfile() {
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
            Falta Instagram e/ou WhatsApp no seu cadastro bit-lab — preenche isso no seu perfil
            e volta aqui pra se inscrever.
          </p>
          <a href="https://apps.bit-lab.tech/profile" className="heroCta">
            <span className="ctaArrow">▶</span> IR PRO PERFIL
          </a>
        </div>
      </section>
    </div>
  );
}
