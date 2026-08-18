import { ArrowRightIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import Glow from "@/components/ui/glow";
import { LinkButton } from "@/components/ui/link-button";
import { Mockup, MockupFrame } from "@/components/ui/mockup";
import Screenshot from "@/components/ui/screenshot";
import { Section } from "@/components/ui/section";

export function Hero() {
  return (
    <Section className="fade-bottom overflow-hidden pb-0 sm:pb-0 md:pb-0">
      <div className="max-w-container mx-auto flex flex-col gap-12 pt-16 sm:gap-24">
        <div className="flex flex-col items-center gap-6 text-center sm:gap-12">
          <Badge variant="outline" className="animate-appear">
            <span className="text-muted-foreground">
              Novo: exportação .JEF
            </span>
            <a href="#recursos" className="flex items-center gap-1">
              Ver recursos
              <ArrowRightIcon className="size-3" />
            </a>
          </Badge>
          <h1
            className={cn(
              "animate-appear from-foreground to-foreground dark:to-muted-foreground relative z-10 inline-block bg-linear-to-r bg-clip-text text-4xl leading-tight font-semibold text-balance text-transparent drop-shadow-2xl sm:text-6xl sm:leading-tight md:text-8xl md:leading-tight",
            )}
          >
            Transforme suas ideias em bordado
          </h1>
          <p className="text-md animate-appear text-muted-foreground relative z-10 max-w-[740px] font-medium text-balance opacity-0 delay-100 sm:text-xl">
            Digitalize fotos e desenhos em pontos prontos pra máquina — cetim,
            tatami e corrido — com camadas, simulação de costura e exportação
            pros principais formatos. Tudo no seu navegador.
          </p>
          <div className="animate-appear relative z-10 flex justify-center gap-4 opacity-0 delay-300">
            <LinkButton href="/app" variant="default" size="lg">
              Começar grátis
            </LinkButton>
            <LinkButton href="#recursos" variant="glow" size="lg">
              Ver recursos
            </LinkButton>
          </div>
          <div className="relative w-full pt-12">
            <MockupFrame
              className="animate-appear opacity-0 delay-700"
              size="small"
            >
              <Mockup
                type="responsive"
                className="bg-background/90 w-full rounded-xl border-0"
              >
                <Screenshot
                  srcLight="/editor-screenshot.png"
                  alt="Editor do Bordado Digital"
                  width={1697}
                  height={916}
                  loading="eager"
                  className="w-full"
                />
              </Mockup>
            </MockupFrame>
            <Glow
              variant="top"
              className="animate-appear-zoom opacity-0 delay-1000"
            />
          </div>
        </div>
      </div>
    </Section>
  );
}
