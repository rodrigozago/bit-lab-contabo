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
      "O Ponto Studio exporta nos formatos DST, PES e JEF, cobrindo a maioria das máquinas domésticas e industriais das marcas mais populares. Também dá pra exportar em SVG pra usar em outros programas.",
  },
  {
    question: "Quais formatos de arquivo posso exportar?",
    answer:
      "DST, PES, JEF e SVG. Novos formatos entram na fila conforme a demanda das bordadeiras.",
  },
  {
    question: "Preciso saber digitalizar pra usar?",
    answer:
      "Não. O Ponto Studio separa as cores da sua imagem automaticamente e sugere os pontos. Você ajusta o que quiser, sem precisar ser especialista.",
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
    question: "Como funciona o cancelamento?",
    answer:
      "Nos planos pagos você cancela a qualquer momento, sem multa. Seus projetos continuam acessíveis dentro dos limites do plano gratuito.",
  },
];

export function FAQ() {
  return (
    <Section id="faq">
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
