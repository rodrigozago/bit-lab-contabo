import type { Meta, StoryObj } from "@storybook/react";
import { Badge } from "@/components/ui/badge";

const meta: Meta<typeof Badge> = {
  title: "UI/Badge",
  component: Badge,
  args: { children: "Badge" },
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "secondary", "destructive", "outline", "free", "premium"],
    },
  },
};
export default meta;

type Story = StoryObj<typeof Badge>;

export const Playground: Story = {};

export const Variantes: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Badge>Pronto</Badge>
      <Badge variant="secondary">Pendente</Badge>
      <Badge variant="destructive">Erro</Badge>
      <Badge variant="outline">na fila</Badge>
      <Badge variant="free">FREE</Badge>
      <Badge variant="premium">Premium</Badge>
    </div>
  ),
};

export const StatusDeAlbum: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Badge variant="secondary">Pendente</Badge>
      <Badge>Escaneando...</Badge>
      <Badge>Pronto</Badge>
      <Badge variant="destructive">Erro</Badge>
      <Badge variant="secondary">Arquivado</Badge>
    </div>
  ),
};
