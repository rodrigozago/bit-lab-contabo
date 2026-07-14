import type { Meta, StoryObj } from "@storybook/react";
import { GalleryCard, GalleryCtaCard } from "@/components/GalleryCard";

const meta: Meta<typeof GalleryCard> = {
  title: "UI/Gallery Card",
  component: GalleryCard,
  parameters: { layout: "padded" },
};
export default meta;

type Story = StoryObj<typeof GalleryCard>;

export const Card: Story = {
  render: () => (
    <div className="w-72">
      <GalleryCard
        image="https://picsum.photos/seed/facelab1/600/900"
        badge="Casamento"
        title="Ana & João"
        subtitle="12 fotos com você"
      />
    </div>
  ),
};

export const SemImagem: Story = {
  render: () => (
    <div className="w-72">
      <GalleryCard badge="Processando" title="Formatura 2026" />
    </div>
  ),
};

/** Reprodução do layout de referência: 2 cards de foto + 1 card CTA. */
export const TrioComCta: Story = {
  render: () => (
    <div className="grid w-[900px] max-w-full grid-cols-1 gap-6 sm:grid-cols-3">
      <GalleryCard
        image="https://picsum.photos/seed/facelab2/600/900"
        badge="Casamento"
        title="Chromatic Vision"
      />
      <GalleryCard
        image="https://picsum.photos/seed/facelab3/600/900"
        badge="Formatura"
        title="Ethereal Form"
      />
      <GalleryCtaCard title="Explore Our Complete Collection" ctaLabel="View Collection" />
    </div>
  ),
};
