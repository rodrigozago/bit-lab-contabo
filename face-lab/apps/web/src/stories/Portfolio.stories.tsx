import type { Meta, StoryObj } from "@storybook/react";
import { GalleryCard } from "@/components/GalleryCard";
import { MarqueeTitle } from "@/components/MarqueeTitle";
import { renderMarkdown } from "@/lib/markdown";

const meta: Meta = {
  title: "Fluxos/Portfólio público",
  parameters: { layout: "fullscreen" },
};
export default meta;

type Story = StoryObj;

const EDITORIAL = `## Sobre o trabalho

Fotografia é sobre **presença** — estar no lugar certo quando a luz encontra o gesto.

Cada evento é editado como uma *exposição*: poucas imagens, escolhidas com calma.`;

export const Letreiro: Story = {
  parameters: { layout: "centered" },
  render: () => (
    <div className="w-[600px] max-w-full bg-background py-10">
      <MarqueeTitle text="João Fotografia" className="text-6xl text-foreground" />
    </div>
  ),
};

export const PaginaDoArtista: Story = {
  render: () => (
    <div className="min-h-screen bg-background pb-24">
      <div className="flex h-[60vh] min-h-[360px] flex-col overflow-hidden">
        <MarqueeTitle text="João Fotografia" className="py-8 text-[9vw] text-foreground" />
        <div className="relative min-h-0 flex-1">
          <img
            src="https://picsum.photos/seed/fl-hero/1600/900"
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
        </div>
      </div>

      <div className="mx-auto mt-16 max-w-2xl space-y-6 px-6 font-serif text-lg text-foreground/90">
        {renderMarkdown(EDITORIAL)}
      </div>

      <div className="mx-auto mt-20 max-w-6xl px-6">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <GalleryCard image="https://picsum.photos/seed/fl-alb1/600/900" title="Ana & João" subtitle="6 fotos" />
          <GalleryCard image="https://picsum.photos/seed/fl-alb2/600/900" title="Formatura 2026" subtitle="4 fotos" />
          <GalleryCard image="https://picsum.photos/seed/fl-alb3/600/900" title="Editorial Verão" subtitle="8 fotos" />
        </div>
      </div>
    </div>
  ),
};
