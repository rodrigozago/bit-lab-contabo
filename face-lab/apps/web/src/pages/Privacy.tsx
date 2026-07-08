import { Link } from "react-router-dom";

// RASCUNHO — não é texto jurídico validado. Preencher os campos entre
// colchetes e revisar com um advogado (LGPD) antes de publicar em produção.
export function Privacy() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <p className="text-sm text-muted-foreground">
        <Link to="/">← Face Lab</Link>
      </p>
      <h1 className="heading-editorial mt-4">Política de Privacidade</h1>
      <p className="mt-1 text-sm text-muted-foreground">Versão 1.0 — rascunho para revisão jurídica</p>

      <div className="mt-10 space-y-6 text-sm leading-relaxed text-muted-foreground">
        <section>
          <h2 className="font-medium text-foreground">1. Controlador</h2>
          <p className="mt-2">
            [RAZÃO SOCIAL], CNPJ [CNPJ], é o controlador dos dados pessoais tratados pelo Face Lab. Contato do
            encarregado (DPO): [E-MAIL DO DPO].
          </p>
        </section>

        <section>
          <h2 className="font-medium text-foreground">2. Dados que coletamos</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Conta e e-mail, via o provedor de login único (SSO) do bit-lab.</li>
            <li>Miniaturas das fotos dos álbuns que você tem acesso (as fotos originais ficam só no Drive do producer).</li>
            <li>
              <strong className="text-foreground">Dado biométrico (sensível, LGPD Art. 5º II):</strong> uma
              representação matemática do seu rosto ("embedding"), gerada a partir das fotos que você envia no
              cadastro facial e das faces detectadas nos álbuns.
            </li>
          </ul>
        </section>

        <section className="rounded-md border-2 border-foreground/20 p-4">
          <h2 className="font-medium text-foreground">3. Consentimento para dados biométricos</h2>
          <p className="mt-2">
            O processamento do seu rosto só acontece depois que você autoriza especificamente essa finalidade, em
            uma etapa separada do aceite geral destes termos (LGPD Art. 11). Você pode revogar esse consentimento a
            qualquer momento removendo seu cadastro facial na página "Meu Rosto" — isso apaga sua referência
            biométrica e as fotos encontradas automaticamente para você.
          </p>
        </section>

        <section>
          <h2 className="font-medium text-foreground">4. Finalidade e base legal</h2>
          <p className="mt-2">
            Usamos seus dados para autenticação, para gerar sua referência facial e casá-la com rostos detectados
            nos álbuns (consentimento específico) e para operar o serviço (execução de contrato). Não usamos seus
            dados para publicidade nem os vendemos a terceiros.
          </p>
        </section>

        <section>
          <h2 className="font-medium text-foreground">5. Compartilhamento</h2>
          <p className="mt-2">
            Não compartilhamos seus dados com terceiros além dos provedores necessários pra operar o serviço
            (hospedagem, o serviço de SSO do bit-lab). As fotos originais nunca saem do Google Drive do producer do
            álbum.
          </p>
        </section>

        <section>
          <h2 className="font-medium text-foreground">6. Retenção</h2>
          <p className="mt-2">
            Miniaturas e dados biométricos de um álbum são apagados automaticamente após 90 dias sem atividade
            (arquivamento). Sua referência facial pessoal (cadastro em "Meu Rosto") fica ativa até você removê-la.
          </p>
        </section>

        <section>
          <h2 className="font-medium text-foreground">7. Seus direitos</h2>
          <p className="mt-2">
            Você pode, a qualquer momento: acessar as fotos que encontramos pra você; revogar o consentimento
            biométrico e apagar seu cadastro facial (página "Meu Rosto"); pedir a exclusão da sua conta, entrando em
            contato com [E-MAIL DO DPO]. Producers podem excluir álbuns inteiros a qualquer momento.
          </p>
        </section>

        <section>
          <h2 className="font-medium text-foreground">8. Segurança</h2>
          <p className="mt-2">
            Credenciais do Google Drive dos producers são armazenadas criptografadas. O acesso a miniaturas e
            recortes de rosto é restrito a quem tem vínculo legítimo com o álbum (dono, administrador, ou pessoas
            já reconhecidas nele).
          </p>
        </section>

        <p>
          Veja também os{" "}
          <Link to="/terms" className="underline">
            Termos de Uso
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
