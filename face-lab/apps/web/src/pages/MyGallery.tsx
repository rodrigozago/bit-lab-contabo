import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { MyAlbum as MyAlbumType } from "@face-lab/shared";
import { api } from "../api";
import { useAuth } from "../App";

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { MyAlbum as MyAlbumType } from "@face-lab/shared";
import { api } from "../api";
import { useAuth } from "../App";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
      <h1 className="text-3xl font-bold tracking-tight">Minhas fotos</h1>
      <p className="mt-1 text-muted-foreground">Álbuns onde te reconhecemos.</p>

      {me && !me.hasEnrollment && (
        <div className="mt-6 flex items-center justify-between rounded-lg border bg-secondary/50 p-4">
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

      <div className="mt-8">
        {error && <p className="text-sm text-destructive">{error}</p>}
        {albums && albums.length === 0 && (
          <div className="rounded-lg border border-dashed py-20 text-center">
            <h3 className="font-semibold tracking-tight">Nenhum álbum encontrado</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Assim que um fotógrafo publicar fotos de um evento em que você esteve, elas aparecerão aqui.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {albums?.map((a) => (
            <Link key={a.id} to={`/me/albums/${a.id}`} className="group">
              <Card className="overflow-hidden transition-all group-hover:shadow-md group-hover:-translate-y-1">
                <div className="aspect-[4/3] w-full bg-secondary" />
                {/* TODO: Usar a.coverImageUrl quando disponível */}
                <CardHeader>
                  <CardTitle className="text-base">{a.name}</CardTitle>
                  <CardDescription>
                    {a.matchCount} foto{a.matchCount === 1 ? "" : "s"} com você
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
          {/* Skeleton loading state */}
          {!albums && !error && Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <div className="aspect-[4/3] w-full animate-pulse bg-secondary/80" />
              <CardHeader>
                <div className="h-5 w-3/4 animate-pulse rounded bg-secondary/80" />
                <div className="mt-2 h-4 w-1/2 animate-pulse rounded bg-secondary/80" />
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
