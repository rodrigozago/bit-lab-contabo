import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const meta: Meta = {
  title: "UI/Forms",
};
export default meta;

type Story = StoryObj;

export const InputComLabel: Story = {
  render: () => (
    <div className="w-80 space-y-4">
      <div className="space-y-1">
        <Label htmlFor="album-name">Nome do álbum / evento</Label>
        <Input id="album-name" placeholder="Casamento Ana & João" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="folder-url">Link da pasta do Google Drive</Label>
        <Input id="folder-url" type="url" placeholder="https://drive.google.com/drive/folders/..." />
      </div>
      <div className="space-y-1">
        <Label htmlFor="disabled">Desabilitado</Label>
        <Input id="disabled" disabled placeholder="Não editável" />
      </div>
    </div>
  ),
};

function CheckboxDemo() {
  const [consent, setConsent] = useState(false);
  return (
    <div className="w-96 space-y-4">
      <label className="flex items-start gap-3 text-sm">
        <Checkbox checked={consent} onCheckedChange={(v) => setConsent(v === true)} className="mt-0.5" />
        Autorizo o processamento do meu rosto para reconhecimento facial, conforme a Política de Privacidade.
      </label>
      <label className="flex items-start gap-3 text-sm">
        <Checkbox defaultChecked className="mt-0.5" />
        Marca d'água nas miniaturas (dá pra ligar/desligar depois)
      </label>
      <label className="flex items-start gap-3 text-sm opacity-70">
        <Checkbox disabled className="mt-0.5" />
        Desabilitado
      </label>
      <Button disabled={!consent} className="w-full">Continuar</Button>
    </div>
  );
}

export const Checkboxes: Story = { render: () => <CheckboxDemo /> };

export const SelectDropdown: Story = {
  render: () => (
    <div className="w-60">
      <Select defaultValue="guest">
        <SelectTrigger>
          <SelectValue placeholder="Papel" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="guest">Guest</SelectItem>
          <SelectItem value="producer">Producer</SelectItem>
          <SelectItem value="admin">Admin</SelectItem>
        </SelectContent>
      </Select>
    </div>
  ),
};
