import { Card, CardContent } from "@/components/ui/card";
import { Section } from "@/components/ui/section";

interface Testimonial {
  quote: string;
  name: string;
  role: string;
}

const TESTIMONIALS: Testimonial[] = [
  {
    quote:
      "Eu levava horas digitalizando cada logo à mão. Com o Ponto Studio, entrego pros clientes no mesmo dia.",
    name: "Marina Alves",
    role: "Ateliê Ponto de Encontro",
  },
  {
    quote:
      "As camadas mudaram meu jeito de trabalhar. Consigo testar variações de cor sem refazer tudo do zero.",
    name: "Cláudia Ramos",
    role: "Bordadeira autônoma",
  },
  {
    quote:
      "Exportei direto pra minha máquina em JEF e ficou perfeito de primeira. Ferramenta indispensável.",
    name: "Rita Nogueira",
    role: "Bordados Fio de Ouro",
  },
];

export function Testimonials() {
  return (
    <Section>
      <div className="max-w-container mx-auto flex flex-col items-center gap-6 sm:gap-12">
        <h2 className="max-w-[560px] text-center text-3xl leading-tight font-semibold text-balance sm:text-5xl sm:leading-tight">
          Quem borda, aprova
        </h2>
        <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <Card key={t.name} className="glass-1 border-0">
              <CardContent className="flex h-full flex-col justify-between gap-6 p-6">
                <p className="text-foreground text-balance">“{t.quote}”</p>
                <div className="flex flex-col">
                  <span className="font-semibold">{t.name}</span>
                  <span className="text-muted-foreground text-sm">
                    {t.role}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </Section>
  );
}
