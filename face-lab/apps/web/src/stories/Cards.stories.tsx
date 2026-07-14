import type { Meta, StoryObj } from "@storybook/react";
import { Camera } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const meta: Meta = {
  title: "UI/Card",
};
export default meta;

type Story = StoryObj;

export const Basico: Story = {
  render: () => (
    <Card className="w-96">
      <CardHeader>
        <CardTitle>Conexão com Google Drive</CardTitle>
        <CardDescription>
          Conecte sua conta Google para que possamos ler as pastas de fotos que você nos indicar.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button>Conectar Google Drive</Button>
      </CardContent>
    </Card>
  ),
};

export const GuiaDeDocumentacao: Story = {
  render: () => (
    <Card className="flex w-96 flex-col p-6 shadow-none">
      <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-secondary">
        <Camera className="h-6 w-6 text-accent" strokeWidth={1.5} />
      </div>
      <h2 className="text-2xl font-semibold">Guia do Producer</h2>
      <p className="mt-1 text-sm font-medium text-muted-foreground">Para Fotógrafos e Produtores de Eventos</p>
      <p className="mt-4 flex-grow text-muted-foreground">
        Aprenda como conectar seu Google Drive, criar álbuns e deixar que o Face Lab encontre as fotos.
      </p>
      <Button variant="outline" className="mt-6 w-full">Baixar PDF</Button>
    </Card>
  ),
};

export const TileDeAlbum: Story = {
  render: () => (
    <div className="w-80">
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium">Casamento Ana & João</p>
        <Badge>Pronto</Badge>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">47/47 fotos · 12 pessoas · 96 rostos</p>
      <div className="mt-3 flex gap-2">
        <Button variant="outline" size="sm" className="flex-1">Abrir</Button>
        <Button size="sm" className="flex-1">Re-escanear</Button>
      </div>
    </div>
  ),
};

export const CardComFooter: Story = {
  render: () => (
    <Card className="w-96">
      <CardHeader>
        <CardTitle>Novo álbum</CardTitle>
        <CardDescription>Cole o link de uma pasta do seu Google Drive.</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">Formulário aqui…</p>
      </CardContent>
      <CardFooter>
        <Button>Criar álbum</Button>
      </CardFooter>
    </Card>
  ),
};
