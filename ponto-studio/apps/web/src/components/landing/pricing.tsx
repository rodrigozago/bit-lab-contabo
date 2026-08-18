import { CircleCheckBig, Sparkles } from "lucide-react";

import { LinkButton } from "@/components/ui/link-button";
import { Section } from "@/components/ui/section";

const BENEFITS = [
  "Projetos ilimitados",
  "Todos os formatos (DST, PES, JEF, SVG)",
  "Simulador de costura",
  "Caneta vetorial pra retoques manuais",
];

export function Pricing() {
  return (
    <Section id="precos">
      <div className="max-w-container mx-auto flex flex-col items-center gap-6 sm:gap-12">
        <div className="flex flex-col items-center gap-4 text-center">
          <h2 className="max-w-[560px] text-3xl leading-tight font-semibold text-balance sm:text-5xl sm:leading-tight">
            Gratuito durante o alpha
          </h2>
          <p className="text-muted-foreground max-w-[640px] text-balance sm:text-lg">
            O Bordado Digital está em fase alpha e todo mundo tem acesso
            completo, de graça. Sem cartão de crédito.
          </p>
        </div>
        <div className="glass-2 dark:glass-3 flex w-full max-w-[480px] flex-col items-center gap-6 rounded-2xl p-8 text-center shadow-xl">
          <Sparkles className="text-brand size-6" />
          <ul className="flex flex-col gap-2">
            {BENEFITS.map((benefit) => (
              <li
                key={benefit}
                className="flex items-center gap-2 text-sm"
              >
                <CircleCheckBig className="text-muted-foreground size-4 shrink-0" />
                {benefit}
              </li>
            ))}
          </ul>
          <LinkButton href="/app" variant="glow" size="lg">
            Começar grátis
          </LinkButton>
        </div>
      </div>
    </Section>
  );
}
