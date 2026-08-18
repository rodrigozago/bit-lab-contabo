import Glow from "@/components/ui/glow";
import { Mockup, MockupFrame } from "@/components/ui/mockup";
import { Section } from "@/components/ui/section";

export function Video() {
  return (
    <Section id="como-funciona">
      <div className="max-w-container mx-auto flex flex-col items-center gap-6 sm:gap-12">
        <div className="flex flex-col items-center gap-4 text-center">
          <h2 className="max-w-[560px] text-3xl leading-tight font-semibold text-balance sm:text-5xl sm:leading-tight">
            Da foto ao bordado em minutos
          </h2>
          <p className="text-muted-foreground max-w-[640px] text-balance sm:text-lg">
            Veja o fluxo completo: importar a imagem, ajustar cores e pontos,
            simular a costura e exportar pra sua máquina.
          </p>
        </div>
        <div className="relative w-full pt-4">
          <MockupFrame size="small">
            <Mockup type="responsive" className="bg-background/90 w-full border-0">
              <video
                autoPlay
                muted
                loop
                playsInline
                poster="/media/export-demo-poster.svg"
                src="/media/export-demo.mp4"
                className="w-full"
              />
            </Mockup>
          </MockupFrame>
          <Glow variant="center" className="opacity-40" />
        </div>
      </div>
    </Section>
  );
}
