import { PUBLIC_URL, oidcIssuer } from "@/lib/studio-oidc";

/** Tela exibida por bloks server-side (ex. CourseSignupForm) quando não há
 * sessão do studio — mesma lógica do OpencdjLoginGate (oferece "Entrar" e
 * "Criar conta" lado a lado em vez de redirecionar direto pro login), mas
 * estilizada com os tokens de design do studio (grid-12/text-heading/
 * bg-accent) em vez das classes cyberpunk de opencdj.css, pra renderizar
 * corretamente dentro de páginas de marketing comuns (ex. /curso-*). */
export function StudioLoginGate({ returnTo }: { returnTo: string }) {
  const studioLoginUrl = `/auth/login?returnTo=${encodeURIComponent(returnTo)}`;
  const signupRedirect = `${PUBLIC_URL}${studioLoginUrl}`;
  const signupUrl = `${oidcIssuer}/signup?app=studio&redirect=${encodeURIComponent(signupRedirect)}`;

  return (
    <div className="grid-12 gap-y-6">
      <div className="col-span-12">
        <p className="text-label text-fg-muted mb-2">ACESSO RESTRITO</p>
        <h3 className="text-heading mb-4">Entra pra se inscrever</h3>
        <p className="text-body text-fg-muted max-w-md">
          A inscrição precisa de uma conta bit-lab. Entra com a sua ou cria uma nova — é rápido.
        </p>
      </div>
      <div className="col-span-12 flex flex-wrap gap-4">
        <a
          href={studioLoginUrl}
          className="text-label w-fit border-b border-accent pb-1"
        >
          ENTRAR
        </a>
        <a
          href={signupUrl}
          className="text-label w-fit border-b border-accent pb-1"
        >
          CRIAR CONTA
        </a>
      </div>
    </div>
  );
}
