import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type { AlbumSummary } from "@face-lab/shared";
import { api } from "../api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Bot, Check, Loader2 } from "lucide-react";

interface GoogleStatus {
  connected: boolean;
  googleEmail: string | null;
  googlePicture: string | null;
}

function StatusBadge({ status }: { status: AlbumSummary["status"] }) {
  const statusMap: Record<AlbumSummary["status"], { variant: "default" | "secondary" | "destructive"; label: string }> = {
    pending: { variant: "secondary", label: "Pendente" },
    scanning: { variant: "default", label: "Escaneando..." },
    ready: { variant: "default", label: "Pronto" },
    error: { variant: "destructive", label: "Erro" },
  };
  const { variant, label } = statusMap[status];
  return <Badge variant={variant}>{label}</Badge>;
}

export function Producer() {
  const [params] = useSearchParams();
  const [google, setGoogle] = useState<GoogleStatus | null>(null);
  const [albums, setAlbums] = useState<AlbumSummary[]>([]);
  const [name, setName] = useState("");
  const [folderUrl, setFolderUrl] = useState("");
  
  useEffect(() => {
    const googleError = params.get("googleError");
    if (googleError) toast.error("Falha na conexão com o Google", { description: googleError });

    api<GoogleStatus>("/api/google/status").then(setGoogle).catch(() => setGoogle({ connected: false, googleEmail: null, googlePicture: null }));
    loadAlbums();
  }, [params]);

  function loadAlbums() {
    api<AlbumSummary[]>("/api/albums").then(setAlbums).catch((e) => toast.error("Erro ao carregar álbuns", { description: e.message }));
  }

  async function createAlbum(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await api<{ id: string; folderName: string; linkSharedWarning: string | null }>("/api/albums", {
        method: "POST",
        body: JSON.stringify({ name, driveFolderUrl: folderUrl }),
      });
      setName("");
      setFolderUrl("");
      toast.success(`Álbum "${res.folderName}" criado.`, { description: res.linkSharedWarning });
      loadAlbums();
    } catch (err) {
      toast.error("Erro ao criar álbum", { description: (err as Error).message });
    }
  }

  async function scan(id: string) {
    toast.info("Escaneamento solicitado...");
    await api(``/api/albums`/${id}`/scan``, { method: "POST" });
    // Optimistic update
    setAlbums(albums.map(a => a.id === id ? { ...a, status: 'scanning' } : a));
    setTimeout(loadAlbums, 2000); // refresh after a bit
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Producer</h1>
        <p className="mt-1 text-muted-foreground">Crie e gerencie seus álbuns a partir do Google Drive.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Conexão com Google Drive</CardTitle>
          <CardDescription>
            Conecte sua conta Google para que possamos ler as pastas de fotos que você nos indicar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {google?.connected ? (
            <div className="flex items-center gap-4">
              <Avatar>
                <AvatarImage src={google.googlePicture!} />
                <AvatarFallback>{google.googleEmail?.charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex-grow">
                <p className="font-semibold">{google.googleEmail}</p>
                <p className="text-sm text-muted-foreground">Conectado com sucesso.</p>
              </div>
              <Button
                variant="ghost"
                onClick={async () => {
                  await api("/api/google", { method: "DELETE" });
                  setGoogle({ connected: false, googleEmail: null, googlePicture: null });
                  toast.info("Conta Google desconectada.");
                }}
              >
                Desconectar
              </Button>
            </div>
          ) : (
            <Button asChild>
              <a href="/api/google/connect">Conectar Google Drive</a>
            </Button>
          )}
        </CardContent>
      </Card>

      {google?.connected && (
        <Card>
          <CardHeader>
            <CardTitle>Novo álbum</CardTitle>
            <CardDescription>
              Cole o link de uma pasta do seu Google Drive para iniciar a criação de um álbum.
            </CardDescription>
          </CardHeader>
          <form onSubmit={createAlbum}>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="album-name">Nome do álbum / evento</Label>
                <Input id="album-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Casamento Ana & João" required />
              </div>
              <div className="space-y-1">
                <Label htmlFor="folder-url">Link da pasta do Google Drive</Label>
                <Input id="folder-url" type="url" value={folderUrl} onChange={(e) => setFolderUrl(e.target.value)} placeholder="https://drive.google.com/drive/folders/..." required />
              </div>
            </CardContent>
            <CardFooter className="flex-col items-start gap-4">
               <p className="text-xs text-muted-foreground">
                Lembre-se de compartilhar a pasta como "qualquer pessoa com o link pode ver" para que os convidados consigam baixar as fotos.
              </p>
              <Button type="submit">Criar álbum</Button>
            </CardFooter>
          </form>
        </Card>
      )}

      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Seus Álbuns</h2>
        <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {albums.map((a) => (
            <Card key={a.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{a.name}</CardTitle>
                  <StatusBadge status={a.status} />
                </div>
                <CardDescription>
                  {a.doneCount}/{a.photoCount} fotos · {a.peopleCount} pessoas · {a.faceCount} rostos
                </CardDescription>
              </CardHeader>
              <CardContent>
                {a.error && <p className="text-sm text-destructive">{a.error}</p>}
              </CardContent>
              <CardFooter className="gap-2">
                <Button asChild variant="outline" className="flex-1"><Link to={``/producer/albums`/${`a.id`}`}>Abrir</Link></Button>
                <Button onClick={() => scan(a.id)} disabled={a.status === "scanning"} className="flex-1">
                  {a.status === "scanning" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Bot className="mr-2 h-4 w-4" />}
                  {a.scannedAt ? "Re-escanear" : "Escanear"}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
        {albums.length === 0 && (
          <div className="mt-4 rounded-lg border border-dashed py-12 text-center">
            <h3 className="font-semibold tracking-tight">Nenhum álbum criado</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Use o formulário acima para criar seu primeiro álbum.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
