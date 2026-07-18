import Glow from "@/components/ui/glow";
import { LinkButton } from "@/components/ui/link-button";
import { Section } from "@/components/ui/section";

export function CTA() {
  return (
    <Section className="group relative overflow-hidden">
      <div className="max-w-container relative z-10 mx-auto flex flex-col items-center gap-6 text-center sm:gap-8">
        <h2 className="max-w-[720px] text-3xl leading-tight font-semibold text-balance sm:text-5xl sm:leading-tight">
          Pronto pra transformar suas ideias em bordado?
        </h2>
        <p className="text-muted-foreground max-w-[560px] text-balance sm:text-lg">
          Crie sua conta e digitalize seu primeiro projeto de graça.
        </p>
        <LinkButton href="/app" variant="default" size="lg">
          Começar grátis
        </LinkButton>
      </div>
      <Glow
        variant="bottom"
        className="opacity-40 transition-opacity duration-500 group-hover:opacity-100"
      />
    </Section>
  );
}
