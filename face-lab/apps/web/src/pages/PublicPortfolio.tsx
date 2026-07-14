import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { PublicPage } from "@face-lab/shared";
import { api } from "../api";
import { GalleryCard } from "@/components/GalleryCard";
import { MarqueeTitle } from "@/components/MarqueeTitle";
import { renderMarkdown } from "@/lib/markdown";

/** Portfólio público do fotógrafo — /p/:slug (sem auth, sem AppLayout). */
export function PublicPortfolio() {
  const { slug } = useParams<{ slug: string }>();
  const [page, setPage] = useState<PublicPage | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    api<PublicPage>(`/api/public/pages/${slug}`)
      .then(setPage)
      .catch(() => setError("Página não encontrada"));
  }, [slug]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">{error}</p>
      </div>
    );
  }
  if (!page) return <div className="min-h-screen bg-background" />;

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* hero claro: letreiro escuro acima, imagem embaixo (posture Zentiq light) */}
      <div className="flex h-[70vh] min-h-[420px] flex-col overflow-hidden">
        <MarqueeTitle text={page.displayName} className="py-8 text-[13vw] text-foreground sm:text-[9vw]" />
        <div className="relative min-h-0 flex-1">
          {page.heroUrl && <img src={page.heroUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />}
        </div>
      </div>

      {/* editorial opcional entre o hero e as imagens */}
      {page.editorialMd && (
        <div className="mx-auto mt-16 max-w-2xl space-y-6 px-6 font-serif text-lg text-foreground/90">
          {renderMarkdown(page.editorialMd)}
        </div>
      )}

      {/* portfolio: só álbuns featured, cada um pela sua featured image */}
      <div className="mx-auto mt-20 max-w-6xl px-6">
        {page.albums.length === 0 ? (
          <p className="text-center text-muted-foreground">Nenhum álbum publicado ainda.</p>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {page.albums.map((a) => (
              <Link key={a.id} to={`/p/${page.slug}/${a.id}`}>
                <GalleryCard
                  image={a.featuredImageUrl}
                  title={a.name}
                  subtitle={`${a.featuredPhotoCount} foto${a.featuredPhotoCount === 1 ? "" : "s"}`}
                />
              </Link>
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
