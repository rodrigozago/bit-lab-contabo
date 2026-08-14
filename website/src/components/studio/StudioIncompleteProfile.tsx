/** Tela exibida quando há sessão do studio mas faltam instagram/whatsapp no
 * perfil (ver comentário em OpencdjIncompleteProfile — a sessão guarda uma
 * cópia desses dados de quando logou, não se atualiza sozinha quando o
 * perfil muda em outro lugar). Generalizada com `returnTo` — o Opencdj
 * original tem "/opencdj" fixo no link de "atualizar sessão"; aqui é
 * parâmetro pra ser reaproveitada por outros bloks gated (ex. CourseSignupForm). */
export function StudioIncompleteProfile({ returnTo }: { returnTo: string }) {
  const refreshUrl = `/auth/logout?returnTo=${encodeURIComponent(
    `/auth/login?returnTo=${encodeURIComponent(returnTo)}`,
  )}`;

  return (
    <div className="grid-12 gap-y-6">
      <div className="col-span-12">
        <p className="text-label text-fg-muted mb-2">PERFIL INCOMPLETO</p>
        <h3 className="text-heading mb-4">Completa seu perfil</h3>
        <p className="text-body text-fg-muted max-w-md">
          Falta Instagram e/ou WhatsApp no seu cadastro bit-lab. Preenche isso no seu perfil —
          depois de salvar, usa o botão &ldquo;atualizar sessão&rdquo; aqui embaixo (só recarregar
          a página não basta).
        </p>
      </div>
      <div className="col-span-12 flex flex-wrap gap-4">
        <a
          href="https://apps.bit-lab.tech/profile"
          className="text-label w-fit border-b border-accent pb-1"
        >
          IR PRO PERFIL
        </a>
        <a href={refreshUrl} className="text-label w-fit border-b border-accent pb-1">
          JÁ PREENCHI, ATUALIZAR SESSÃO
        </a>
      </div>
    </div>
  );
}
