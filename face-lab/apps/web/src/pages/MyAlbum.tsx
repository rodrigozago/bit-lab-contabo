import { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import type { MyPhoto } from "@face-lab/shared";
import { api } from "../api";
import { toast } from "sonner";
import { ChevronLeft, Download, ExternalLink, ThumbsDown, ThumbsUp } from "lucide-react";
import { PhotoCard } from "@/components/PhotoCard";
import { PhotoDialog } from "@/components/PhotoDialog";
import { Button } from "@/components/ui/button";

export function MyAlbum() {
  const { id } = useParams<{ id: string }>();
  const [photos, setPhotos] = useState<MyPhoto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [dialogPhoto, setDialogPhoto] = useState<MyPhoto | null>(null);
  const [downloading, setDownloading] = useState<{ done: number; total: number } | null>(null);
  const cancelDownloads = useRef(false);

  function load() {
    api<MyPhoto[]>(`/api/my/albums/${id}/photos`).then(setPhotos).catch((e) => setError(String(e.message)));
  }
  useEffect(load, [id]);

  async function confirm(faceId: string) {
    setBusy(faceId);
    try {
      const r = await api<{ newMatches: number }>(`/api/my/matches/${faceId}/confirm`, { method: "POST", body: JSON.stringify({}) });
      toast.success(r.newMatches > 0 ? `Confirmado! Encontramos mais ${r.newMatches} foto(s) com você.` : "Confirmado!");
      setDialogPhoto(null);
      load();
    } finally {
      setBusy(null);
    }
  }

  // baixa todas as fotos em sequência via webContentLink do Drive (o Drive já
  // manda Content-Disposition: attachment). Delay entre cliques evita o
  // bloqueio de múltiplos downloads; o Chrome pede permissão uma vez.
  // No futuro vira função premium (fotógrafo paga) — por ora liberada.
  async function downloadAll() {
    const targets = (photos ?? []).filter((p) => p.webContentLink);
    if (targets.length === 0) return;
    cancelDownloads.current = false;
    setDownloading({ done: 0, total: targets.length });

    for (let i = 0; i < targets.length; i++) {
      if (cancelDownloads.current) break;
      const link = targets[i]?.webContentLink;
      if (!link) continue;
      const a = document.createElement("a");
      a.href = link;
      a.rel = "noreferrer";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setDownloading({ done: i + 1, total: targets.length });
      if (i < targets.length - 1) await new Promise((r) => setTimeout(r, 1200));
    }
    setDownloading(null);
    if (!cancelDownloads.current) toast.success("Downloads iniciados — confira a pasta de downloads do navegador.");
  }

  useEffect(() => () => void (cancelDownloads.current = true), []);

  async function reject(faceId: string) {
    setBusy(faceId);
    try {
      await api(`/api/my/matches/${faceId}/reject`, { method: "POST", body: JSON.stringify({}) });
      toast.info("Ok — removemos todas as fotos dessa pessoa da sua galeria.");
      setDialogPhoto(null);
      load();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <Link to="/me" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" />
        Voltar para Meus Álbuns
      </Link>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="heading-editorial">Fotos com você</h1>
          <p className="mt-1 text-muted-foreground">O quadrado marca qual rosto achamos que é você — confirme ou corrija.</p>
        </div>
        {photos && photos.some((p) => p.webContentLink) && (
          <Button variant="outline" onClick={downloadAll} disabled={!!downloading}>
            <Download size={16} className="mr-2" />
            {downloading ? `Baixando ${downloading.done}/${downloading.total}…` : "Baixar todas"}
          </Button>
        )}
      </div>

      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

      <div className="mt-10 columns-1 gap-8 space-y-8 sm:columns-2 lg:columns-3 xl:columns-4">
        {photos?.map((p) => (
          <PhotoCard key={p.id} photo={p} isBusy={busy === p.faceId} onConfirm={confirm} onReject={reject} onClick={() => setDialogPhoto(p)} />
        ))}
        {!photos &&
          !error &&
          Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="break-inside-avoid">
              <div className="aspect-[4/3] w-full animate-pulse bg-secondary/80" />
            </div>
          ))}
      </div>

      {photos && photos.length === 0 && (
        <div className="mt-8 py-20 text-center">
          <h3 className="font-medium">Nenhuma foto encontrada</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            As fotos deste álbum podem ter sido removidas após você rejeitar um rosto.
          </p>
        </div>
      )}

      {photos && photos.length > 0 && (
        <div className="mt-12 flex justify-center border-t pt-10">
          <Button asChild variant="outline">
            <Link to={`/me/albums/${id}/all`}>Todas as fotos</Link>
          </Button>
        </div>
      )}

      <PhotoDialog
        open={!!dialogPhoto}
        onOpenChange={(open) => !open && setDialogPhoto(null)}
        thumbUrl={dialogPhoto?.thumbUrl ?? null}
        name={dialogPhoto?.name ?? ""}
        photoWidth={dialogPhoto?.photoWidth}
        photoHeight={dialogPhoto?.photoHeight}
        bbox={dialogPhoto?.faceBbox}
        confirmed={dialogPhoto?.matchStatus === "confirmed"}
        actions={
          dialogPhoto && (
            <>
              {dialogPhoto.matchStatus !== "confirmed" && (
                <Button size="sm" disabled={busy === dialogPhoto.faceId} onClick={() => confirm(dialogPhoto.faceId)}>
                  <ThumbsUp size={16} className="mr-1" /> Sou eu
                </Button>
              )}
              <Button size="sm" variant="outline" disabled={busy === dialogPhoto.faceId} onClick={() => reject(dialogPhoto.faceId)}>
                <ThumbsDown size={16} className="mr-1" /> Não sou eu
              </Button>
              {dialogPhoto.webContentLink && (
                <Button size="icon" variant="ghost" asChild>
                  <a href={dialogPhoto.webContentLink} target="_blank" rel="noreferrer">
                    <Download size={16} />
                  </a>
                </Button>
              )}
              {dialogPhoto.webViewLink && (
                <Button size="icon" variant="ghost" asChild>
                  <a href={dialogPhoto.webViewLink} target="_blank" rel="noreferrer">
                    <ExternalLink size={16} />
                  </a>
                </Button>
              )}
            </>
          )
        }
      />
    </div>
  );
}
