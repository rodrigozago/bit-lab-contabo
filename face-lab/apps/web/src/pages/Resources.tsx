import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Download, FileText, Users, Camera } from "lucide-react";

const GUIDES = [
  {
    id: "producer",
    title: "Guia do Producer",
    subtitle: "Para Fotógrafos e Produtores de Eventos",
    description:
      "Aprenda como conectar seu Google Drive, criar álbuns e deixar que o Face Lab encontre as fotos de seus convidados automaticamente.",
    icon: Camera,
    file: "/docs/Face_Lab_Producer_Guide.pdf",
    accent: true, // momento ouro da página (BRAND.md: máx 1-2 por tela)
  },
  {
    id: "guest",
    title: "Guia do Convidado",
    subtitle: "Para Clientes/Convidados",
    description:
      "Descubra como cadastrar seu rosto e encontrar todas as suas fotos de eventos em minutos, sem trabalho manual.",
    icon: Users,
    file: "/docs/Face_Lab_Guest_Guide.pdf",
    accent: false,
  },
];

export default function Resources() {
  const handleDownload = (filePath: string, fileName: string) => {
    const link = document.createElement("a");
    link.href = filePath;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b">
        <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
          <h1 className="heading-editorial">Documentação</h1>
          <p className="mt-2 text-lg text-muted-foreground">
            Guias completos para cada papel no Face Lab
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Grid de Guias */}
        <div className="grid gap-8 md:grid-cols-2">
          {GUIDES.map((guide) => {
            const Icon = guide.icon;
            return (
              <Card key={guide.id} className="flex flex-col p-6 shadow-none">
                {/* Ícone */}
                <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-secondary">
                  <Icon className={`h-6 w-6 ${guide.accent ? "text-accent" : "text-foreground"}`} strokeWidth={1.5} />
                </div>

                {/* Conteúdo */}
                <h2 className="text-2xl font-semibold">{guide.title}</h2>
                <p className="mt-1 text-sm font-medium text-muted-foreground">{guide.subtitle}</p>
                <p className="mt-4 flex-grow text-muted-foreground">{guide.description}</p>

                {/* Informações */}
                <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
                  <FileText className="h-4 w-4" />
                  <span>3 páginas • PDF</span>
                </div>

                {/* Botão Download */}
                <Button
                  onClick={() => handleDownload(guide.file, guide.file.split("/").pop() || "guide.pdf")}
                  className="mt-6 w-full"
                  variant="outline"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Baixar PDF
                </Button>
              </Card>
            );
          })}
        </div>

        {/* Informações Adicionais */}
        <div className="mt-12 rounded-lg border bg-secondary p-6">
          <h3 className="text-lg font-semibold">Encontrou um problema?</h3>
          <p className="mt-2 text-muted-foreground">Reporte bugs ou deixe sugestões:</p>
          <div className="mt-4 flex flex-col gap-3 text-sm">
            <div>
              <strong>GitHub Issues:</strong>{" "}
              <a
                href="https://github.com/rodrigozago/face-lab-issues/issues"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent-secondary hover:underline"
              >
                github.com/rodrigozago/face-lab-issues/issues
              </a>
            </div>
            <div>
              <strong>Email:</strong>{" "}
              <a href="mailto:rodrigo@bit-lab.tech" className="text-accent-secondary hover:underline">
                rodrigo@bit-lab.tech
              </a>
            </div>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Inclua: browser, OS, screenshots e steps para reproduzir o problema
          </p>
        </div>

        {/* Versão */}
        <div className="mt-8 text-center text-sm text-muted-foreground">
          <p>Face Lab Alpha — Gato-Veloz-v0.1 — Julho 2026</p>
        </div>
      </div>
    </div>
  );
}
