import { Gem, Sparkles, Users } from "lucide-react";

import { PricingColumn } from "@/components/ui/pricing-column";
import { Section } from "@/components/ui/section";

export function Pricing() {
  return (
    <Section id="precos">
      <div className="max-w-container mx-auto flex flex-col items-center gap-6 sm:gap-12">
        <div className="flex flex-col items-center gap-4 text-center">
          <h2 className="max-w-[560px] text-3xl leading-tight font-semibold text-balance sm:text-5xl sm:leading-tight">
            Planos pra cada etapa
          </h2>
          <p className="text-muted-foreground max-w-[640px] text-balance sm:text-lg">
            Comece de graça e evolua quando o seu ateliê crescer.
          </p>
        </div>
        <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-3">
          <PricingColumn
            name="Grátis"
            icon={<Sparkles className="size-4" />}
            description="Pra experimentar e fazer seus primeiros bordados."
            price={0}
            priceNote="Sem cartão de crédito."
            cta={{ variant: "glow", label: "Começar grátis", href: "/app" }}
            features={[
              "Até 3 projetos",
              "Exportação SVG",
              "Simulador de costura",
              "Processamento local",
            ]}
          />
          <PricingColumn
            name="Pro"
            variant="glow-brand"
            icon={<Gem className="size-4" />}
            description="Pra quem borda profissionalmente todo dia."
            price={29}
            priceNote="Cancele quando quiser."
            cta={{ variant: "default", label: "Assinar o Pro", href: "/app" }}
            features={[
              "Projetos ilimitados",
              "Todos os formatos (DST, PES, JEF, SVG)",
              "Camadas ilimitadas",
              "Histórico automático",
              "Suporte prioritário",
            ]}
          />
          <PricingColumn
            name="Ateliê"
            icon={<Users className="size-4" />}
            description="Pra equipes e ateliês com vários bordadeiros."
            price={79}
            priceNote="Cobrança por ateliê."
            cta={{ variant: "glow", label: "Falar com a gente", href: "/app" }}
            features={[
              "Tudo do Pro",
              "Multiusuário",
              "Biblioteca compartilhada",
              "Gestão de permissões",
            ]}
          />
        </div>
      </div>
    </Section>
  );
}
