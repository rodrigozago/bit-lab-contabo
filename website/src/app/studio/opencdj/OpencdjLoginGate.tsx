import { PUBLIC_URL, oidcIssuer } from "@/lib/studio-oidc";

/** Tela de acesso do /opencdj sem sessão — em vez de redirecionar direto pro
 * login (como o resto da área studio faz), oferece "Entrar" e "Criar conta"
 * lado a lado. Quem já tem sessão em auth.bit-lab.tech (SSO) passa direto
 * em qualquer um dos dois; quem não tem, cai no signup self-service do app
 * "studio" — precisa estar com allow_self_signup ligado pra esse app no
 * painel admin (apps.bit-lab.tech/admin/apps), passo manual, não dá pra
 * ligar por código. */
export function OpencdjLoginGate({ returnTo }: { returnTo: string }) {
  const studioLoginUrl = `/auth/login?returnTo=${encodeURIComponent(returnTo)}`;
  const signupRedirect = `${PUBLIC_URL}${studioLoginUrl}`;
  const signupUrl = `${oidcIssuer}/signup?app=studio&redirect=${encodeURIComponent(signupRedirect)}`;

  return (
    <div className="opencdj-page">
      <section className="hero" style={{ minHeight: "100vh" }}>
        <div className="heroBg" />
        <div className="heroContent">
          <div className="heroBadge">[ FREQUÊNCIA RESTRITA // ORDEM OCULTA ]</div>
          <h1 className="headline" style={{ marginTop: "1rem" }}>
            Acesso restrito
          </h1>
          <p className="description" style={{ maxWidth: "32rem", textAlign: "center" }}>
            O Open CDJ agora é só pra quem tem conta bit-lab. Entra com a sua ou cria uma nova —
            é rápido.
          </p>
          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", justifyContent: "center" }}>
            <a href={studioLoginUrl} className="heroCta">
              <span className="ctaArrow">▶</span> ENTRAR
            </a>
            <a href={signupUrl} className="heroCta">
              <span className="ctaArrow">▶</span> CRIAR CONTA
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
