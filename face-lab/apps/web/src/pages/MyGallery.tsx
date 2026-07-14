import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { MyAlbum as MyAlbumType } from "@face-lab/shared";
import { api } from "../api";
import { useAuth } from "../App";
import { Button } from "@/components/ui/button";
import { GalleryCard } from "@/components/GalleryCard";
import { AlertTriangle } from "lucide-react";

export function MyGallery() {
  const { me } = useAuth();
  const [albums, setAlbums] = useState<MyAlbumType[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<MyAlbumType[]>("/api/my/albums").then(setAlbums).catch((e) => setError(String(e.message)));
  }, []);

  return (
    <div>
      <h1 className="heading-editorial">Minhas fotos</h1>
      <p className="mt-1 text-muted-foreground">Álbuns onde te reconhecemos.</p>

      {me && !me.hasEnrollment && (
        <div className="mt-6 flex items-center justify-between gap-4 bg-secondary/50 p-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-secondary-foreground/80" />
            <p className="text-sm font-medium text-secondary-foreground">
              Você ainda não cadastrou seu rosto — sem isso não conseguimos te encontrar nas fotos.
            </p>
          </div>
          <Button asChild>
            <Link to="/enroll">Cadastrar meu rosto</Link>
          </Button>
        </div>
      )}

      <div className="mt-10">
        {error && <p className="text-sm text-destructive">{error}</p>}
        {albums && albums.length === 0 && (
          <div className="py-20 text-center">
            <h3 className="font-medium">Nenhum álbum encontrado</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Assim que um fotógrafo publicar fotos de um evento em que você esteve, elas aparecerão aqui.
            </p>
          </div>
        )}

        {/* gallery cards estilo Zentiq — imagem full-bleed, badge no topo, título serif sobre a foto */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {albums?.map((a) => (
            <Link key={a.id} to={`/me/albums/${a.id}`}>
              <GalleryCard
                image={a.coverUrl}
                badge={`${a.matchCount} foto${a.matchCount === 1 ? "" : "s"} com você`}
                title={a.name}
              />
            </Link>
          ))}
          {!albums &&
            !error &&
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="aspect-[2/3] w-full animate-pulse rounded-lg bg-secondary/80" />
            ))}
        </div>
      </div>
    </div>
  );
}
