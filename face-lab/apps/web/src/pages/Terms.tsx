import { Link } from "react-router-dom";

// RASCUNHO — não é texto jurídico validado. Preencher os campos entre
// colchetes e revisar com um advogado antes de publicar em produção.
export function Terms() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <p className="text-sm text-muted-foreground">
        <Link to="/">← Face Lab</Link>
      </p>
      <h1 className="heading-editorial mt-4">Termos de Uso</h1>
      <p className="mt-1 text-sm text-muted-foreground">Versão 1.0 — rascunho para revisão jurídica</p>

      <div className="mt-10 space-y-6 text-sm leading-relaxed text-muted-foreground">
        <section>
          <h2 className="font-medium text-foreground">1. Quem somos</h2>
          <p className="mt-2">
            O Face Lab é operado por [RAZÃO SOCIAL], CNPJ [CNPJ], com sede em [ENDEREÇO]. Contato do encarregado
            de proteção de dados (DPO): [E-MAIL DO DPO].
          </p>
        </section>

        <section>
          <h2 className="font-medium text-foreground">2. O que o serviço faz</h2>
          <p className="mt-2">
            O Face Lab permite que fotógrafos e organizadores de eventos ("producers") vinculem pastas do próprio
            Google Drive como álbuns, e que convidados ("usuários") cadastrem uma referência do próprio rosto para
            encontrar automaticamente as fotos em que aparecem. As fotos originais nunca são copiadas ou
            armazenadas pelo Face Lab — permanecem no Google Drive do producer.
          </p>
        </section>

        <section>
          <h2 className="font-medium text-foreground">3. Contas e papéis</h2>
          <p className="mt-2">
            O login é feito via SSO. Todo usuário começa como convidado; o papel de producer é concedido por um
            administrador. O papel de administrador é gerenciado no serviço de autenticação central e não pode ser
            alterado dentro do Face Lab.
          </p>
        </section>

        <section>
          <h2 className="font-medium text-foreground">4. Responsabilidade do producer</h2>
          <p className="mt-2">
            Ao criar um álbum, o producer declara que informou os participantes do evento sobre o uso de
            reconhecimento facial nas fotos e obteve o consentimento necessário deles, quando aplicável. O producer
            é responsável pelo conteúdo das fotos que disponibiliza e pelo compartilhamento adequado da pasta do
            Drive.
          </p>
        </section>

        <section>
          <h2 className="font-medium text-foreground">5. Retenção e arquivamento</h2>
          <p className="mt-2">
            Álbuns sem atividade (sem novo escaneamento) por 90 dias têm suas miniaturas, recortes de rosto e
            referências biométricas apagadas automaticamente — o álbum e seus metadados (nome, contagens, links do
            Drive) permanecem, mas sem dados biométricos associados. O producer pode reativar um álbum arquivado a
            qualquer momento, o que reprocessa as fotos novamente.
          </p>
        </section>

        <section>
          <h2 className="font-medium text-foreground">6. Alterações</h2>
          <p className="mt-2">
            Estes termos podem ser atualizados. Mudanças materiais exigem novo aceite antes de continuar usando o
            serviço.
          </p>
        </section>

        <p>
          Veja também a{" "}
          <Link to="/privacy" className="underline">
            Política de Privacidade
          </Link>
          , que detalha o tratamento de dados pessoais, incluindo dados biométricos.
        </p>
      </div>
    </div>
  );
}
