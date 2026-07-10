import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Download, FileText, Users, Camera } from "lucide-react";

export default function Resources() {
  const guides = [
    {
      id: "producer",
      title: "Guia do Producer",
      subtitle: "Para Fotógrafos e Produtores de Eventos",
      description:
        "Aprenda como conectar seu Google Drive, criar álbuns e deixar que o Face Lab encontre as fotos de seus convidados automaticamente.",
      icon: Camera,
      file: "/docs/Face_Lab_Producer_Guide.pdf",
      color: "bg-blue-50 border-blue-200",
      textColor: "text-blue-600",
    },
    {
      id: "guest",
      title: "Guia do Convidado",
      subtitle: "Para Clientes/Convidados",
      description:
        "Descubra como cadastrar seu rosto e encontrar todas as suas fotos de eventos em minutos, sem trabalho manual.",
      icon: Users,
      file: "/docs/Face_Lab_Guest_Guide.pdf",
      color: "bg-green-50 border-green-200",
      textColor: "text-green-600",
    },
  ];

  const handleDownload = (filePath: string, fileName: string) => {
    const link = document.createElement("a");
    link.href = filePath;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="border-b border-gray-200 bg-gradient-to-r from-blue-50 to-blue-100">
        <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-gray-900">Documentação</h1>
          <p className="mt-2 text-lg text-gray-600">
            Guias completos para cada papel no Face Lab
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Grid de Guias */}
        <div className="grid gap-8 md:grid-cols-2">
          {guides.map((guide) => {
            const Icon = guide.icon;
            return (
              <Card
                key={guide.id}
                className={`flex flex-col border-2 ${guide.color} p-6 transition-all hover:shadow-lg`}
              >
                {/* Ícone */}
                <div
                  className={`mb-4 inline-flex w-12 h-12 items-center justify-center rounded-lg ${guide.textColor} bg-white`}
                >
                  <Icon className="h-6 w-6" />
                </div>

                {/* Conteúdo */}
                <h2 className="text-2xl font-bold text-gray-900">
                  {guide.title}
                </h2>
                <p className={`mt-1 text-sm font-medium ${guide.textColor}`}>
                  {guide.subtitle}
                </p>
                <p className="mt-4 flex-grow text-gray-600">
                  {guide.description}
                </p>

                {/* Informações */}
                <div className="mt-6 flex items-center gap-2 text-sm text-gray-500">
                  <FileText className="h-4 w-4" />
                  <span>3 páginas • PDF</span>
                </div>

                {/* Botão Download */}
                <Button
                  onClick={() =>
                    handleDownload(
                      guide.file,
                      guide.file.split("/").pop() || "guide.pdf"
                    )
                  }
                  className={`mt-6 w-full ${guide.textColor} border-current hover:bg-blue-50 border`}
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
        <div className="mt-12 rounded-lg bg-blue-50 border border-blue-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900">
            Encontrou um problema?
          </h3>
          <p className="mt-2 text-gray-600">
            Reporte bugs ou deixe sugestões:
          </p>
          <div className="mt-4 flex flex-col gap-3 text-sm text-gray-700">
            <div>
              <strong>GitHub Issues:</strong>{" "}
              <a
                href="https://github.com/rodrigozago/face-lab-issues/issues"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                github.com/rodrigozago/face-lab-issues/issues
              </a>
            </div>
            <div>
              <strong>Email:</strong>{" "}
              <a href="mailto:rodrigo@bit-lab.tech" className="text-blue-600 hover:underline">
                rodrigo@bit-lab.tech
              </a>
            </div>
          </div>
          <p className="mt-4 text-xs text-gray-500">
            Inclua: browser, OS, screenshots e steps para reproduzir o problema
          </p>
        </div>

        {/* Versão */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>Face Lab Alpha — Gato-Veloz-v0.1 — Julho 2026</p>
        </div>
      </div>
    </div>
  );
}
