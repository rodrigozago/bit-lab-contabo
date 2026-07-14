import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { PublicAlbum as PublicAlbumType } from "@face-lab/shared";
import { api } from "../api";
import { MarqueeTitle } from "@/components/MarqueeTitle";

/** Álbum featured do portfólio público — /p/:slug/:albumId (sem auth). */
export function PublicAlbum() {
  const { slug, albumId } = useParams<{ slug: string; albumId: string }>();
  const [album, setAlbum] = useState<PublicAlbumType | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug || !albumId) return;
    api<PublicAlbumType>(`/api/public/pages/${slug}/albums/${albumId}`)
      .then(setAlbum)
      .catch(() => setError("Álbum não encontrado"));
  }, [slug, albumId]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">{error}</p>
      </div>
    );
  }
  if (!album) return <div className="min-h-screen bg-background" />;

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* hero compacto: letreiro com o nome do álbum */}
      <div className="border-b py-16">
        <Link
          to={`/p/${album.slug}`}
          className="mb-6 block px-6 text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground"
        >
          ← {album.displayName}
        </Link>
        <MarqueeTitle text={album.name} className="text-[11vw] sm:text-[7vw]" />
      </div>

      {/* fotos featured — sem marca d'água quando processadas */}
      <div className="mx-auto mt-12 max-w-6xl px-6">
        {album.photos.length === 0 ? (
          <p className="text-center text-muted-foreground">Nenhuma foto publicada ainda.</p>
        ) : (
          <div className="columns-1 gap-6 sm:columns-2 lg:columns-3 [&>figure]:mb-6">
            {album.photos.map((p) => (
              <figure key={p.id} className="break-inside-avoid">
                <img
                  src={p.url}
                  alt=""
                  width={p.width ?? undefined}
                  height={p.height ?? undefined}
                  loading="lazy"
                  className="block h-auto w-full bg-secondary"
                />
              </figure>
            ))}
          </div>
        )}
      </div>

      <footer className="mt-24 text-center text-xs uppercase tracking-widest text-muted-foreground">
        <Link to="/" className="hover:text-foreground">Face Lab</Link>
      </footer>
    </div>
  );
}
