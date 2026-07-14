import type { Meta, StoryObj } from "@storybook/react";
import { Camera, Download, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";

const meta: Meta<typeof Button> = {
  title: "UI/Button",
  component: Button,
  args: { children: "Botão" },
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "secondary", "outline", "ghost", "link", "destructive", "premium"],
    },
    size: { control: "select", options: ["default", "sm", "lg", "icon", "icon-sm"] },
  },
};
export default meta;

type Story = StoryObj<typeof Button>;

export const Playground: Story = {};

export const Variantes: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button>Default</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="link">Link</Button>
      <Button variant="destructive">Destructive</Button>
      <Button variant="premium">Premium (ouro)</Button>
    </div>
  ),
};

export const Tamanhos: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button size="lg">Large</Button>
      <Button>Default</Button>
      <Button size="sm">Small</Button>
      <Button size="icon"><Heart className="h-4 w-4" /></Button>
      <Button size="icon-sm" variant="ghost"><Download className="h-4 w-4" /></Button>
    </div>
  ),
};

export const ComIcone: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button><Camera className="mr-2 h-4 w-4" /> Ligar câmera</Button>
      <Button variant="outline"><Download className="mr-2 h-4 w-4" /> Baixar PDF</Button>
      <Button disabled>Desabilitado</Button>
    </div>
  ),
};

export const DarkMuseum: Story = {
  parameters: { backgrounds: { default: "dark-museum" } },
  render: () => (
    <div className="dark-museum flex flex-wrap items-center gap-3 rounded-lg bg-background p-8">
      <Button size="lg">Entrar / Criar conta</Button>
      <Button variant="outline">Saiba mais</Button>
      <Button variant="premium">Premium</Button>
    </div>
  ),
};
