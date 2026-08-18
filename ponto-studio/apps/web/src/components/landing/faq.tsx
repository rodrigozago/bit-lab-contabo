import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Section } from "@/components/ui/section";

const FAQS = [
  {
    question: "Quais máquinas são compatíveis?",
    answer:
      "O Bordado Digital exporta nos formatos DST, PES e JEF, cobrindo a maioria das máquinas domésticas e industriais das marcas mais populares. Também dá pra exportar em SVG pra usar em outros programas.",
  },
  {
    question: "Quais formatos de arquivo posso exportar?",
    answer:
      "DST, PES, JEF e SVG. Novos formatos entram na fila conforme a demanda das bordadeiras.",
  },
  {
    question: "Preciso saber digitalizar pra usar?",
    answer:
      "Não. O Bordado Digital separa as cores da sua imagem automaticamente e sugere os pontos. Você ajusta o que quiser, sem precisar ser especialista.",
  },
  {
    question: "Funciona com foto de celular?",
    answer:
      "Sim. Você pode enviar uma foto tirada no celular e o editor cuida da conversão. Imagens com fundo limpo e boa iluminação dão os melhores resultados.",
  },
  {
    question: "Posso editar o projeto depois?",
    answer:
      "Claro. Cada projeto fica salvo com histórico automático, então você volta, ajusta e reexporta quando quiser.",
  },
  {
    question: "O Bordado Digital é gratuito?",
    answer:
      "Sim. Durante o alpha, o acesso é 100% gratuito para todo mundo — sem cartão de crédito, sem limite de projetos.",
  },
];

// FAQPage structured data — gerado a partir do mesmo array FAQS que renderiza
// na tela, pra nunca ficar dessincronizado do conteúdo visível (Google exige
// isso pra manter o rich result elegível). Ver
// https://developers.google.com/search/docs/appearance/structured-data/faqpage
const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQS.map((faq) => ({
    "@type": "Question",
    name: faq.question,
    acceptedAnswer: { "@type": "Answer", text: faq.answer },
  })),
};

export function FAQ() {
  return (
    <Section id="faq">
      {/* dangerouslySetInnerHTML (não children de texto): renderToString escapa
          texto de <script> como qualquer outro nó (vira &quot; etc.), quebrando
          o JSON — dangerouslySetInnerHTML grava o HTML cru, igual no client
          render. Conteúdo é gerado só a partir de FAQS (estático, sem input de
          usuário), sem risco de XSS. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <div className="max-w-container mx-auto flex max-w-[720px] flex-col items-center gap-6 sm:gap-12">
        <h2 className="text-center text-3xl leading-tight font-semibold text-balance sm:text-5xl sm:leading-tight">
          Perguntas frequentes
        </h2>
        <Accordion type="single" collapsible className="w-full">
          {FAQS.map((faq, i) => (
            <AccordionItem key={faq.question} value={`item-${i}`}>
              <AccordionTrigger>{faq.question}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </Section>
  );
}
