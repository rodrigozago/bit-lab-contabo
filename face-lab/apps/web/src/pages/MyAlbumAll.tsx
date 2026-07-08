import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import type { AllAlbumPhoto } from "@face-lab/shared";
import { api } from "../api";
import { toast } from "sonner";
import { Check, ChevronLeft, ThumbsUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PhotoDialog } from "@/components/PhotoDialog";

export function MyAlbumAll() {
  const { id } = useParams<{ id: string }>();
  const [photos, setPhotos] = useState<AllAlbumPhoto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [claimingFaceId, setClaimingFaceId] = useState<string | null>(null);
  const [dialogPhoto, setDialogPhoto] = useState<AllAlbumPhoto | null>(null);

  function load() {
    api<AllAlbumPhoto[]>(`/api/my/albums/${id}/all-photos`)
      .then(setPhotos)
      .catch((e) => setError(String(e.message)));
  }
  useEffect(load, [id]);

  async function claim(faceId: string) {
    setClaimingFaceId(faceId);
    try {
      const r = await api<{ newMatches: number }>(`/api/faces/${faceId}/claim`, { method: "POST", body: JSON.stringify({}) });
      toast.success(r.newMatches > 0 ? `Marcado! Encontramos mais ${r.newMatches} foto(s) com você.` : "Marcado como você!");
      load();
      setDialogPhoto((d) => {
        if (!d) return d;
        const faces = d.faces.map((f) => (f.faceId === faceId ? { ...f, claimedByMe: true } : f));
        return { ...d, faces };
      });
    } catch (err) {
      toast.error("Não deu pra marcar", { description: (err as Error).message });
    } finally {
      setClaimingFaceId(null);
    }
  }

  return (
    <div>
      <Link to={`/me/albums/${id}`} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" />
        Voltar
      </Link>
      <h1 className="heading-editorial mt-4">Todas as fotos</h1>
      <p className="mt-1 text-muted-foreground">
        Não te achamos em alguma foto? Clique no seu rosto pra marcar "Sou eu" e treinar o reconhecimento.
      </p>

      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

      <div className="mt-10 columns-1 gap-8 space-y-8 sm:columns-2 lg:columns-3 xl:columns-4">
        {photos?.map((p) => {
          const unclaimed = p.faces.filter((f) => !f.claimedByMe);
          const allClaimed = p.faces.length > 0 && unclaimed.length === 0;
          const onlyUnclaimed = unclaimed.length === 1 ? unclaimed[0] : null;
          return (
            <figure key={p.id} className="break-inside-avoid">
              <button
                type="button"
                className="block w-full cursor-zoom-in overflow-hidden bg-secondary"
                onClick={() => setDialogPhoto(p)}
                disabled={!p.thumbUrl}
              >
                {p.thumbUrl && <img src={p.thumbUrl} alt={p.name} loading="lazy" className="block h-auto w-full" />}
              </button>
              <figcaption className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                {allClaimed ? (
                  <span className="flex items-center gap-1 font-medium text-ok">
                    <Check size={13} /> Você
                  </span>
                ) : onlyUnclaimed ? (
                  <Button size="icon-sm" variant="ghost" disabled={claimingFaceId === onlyUnclaimed.faceId} title="Sou eu" onClick={() => claim(onlyUnclaimed.faceId)}>
                    <ThumbsUp size={14} />
                  </Button>
                ) : unclaimed.length > 1 ? (
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setDialogPhoto(p)}>
                    Marcar quem é você ({unclaimed.length})
                  </Button>
                ) : (
                  <span className="text-muted-foreground/60">nenhum rosto detectado</span>
                )}
              </figcaption>
            </figure>
          );
        })}
        {!photos &&
          !error &&
          Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="break-inside-avoid">
              <div className="aspect-[4/3] w-full animate-pulse bg-secondary/80" />
            </div>
          ))}
      </div>

      {photos && photos.length === 0 && <p className="mt-8 text-center text-muted-foreground">Nenhuma foto processada ainda.</p>}

      <PhotoDialog
        open={!!dialogPhoto}
        onOpenChange={(open) => !open && setDialogPhoto(null)}
        thumbUrl={dialogPhoto?.thumbUrl ?? null}
        name={dialogPhoto?.name ?? ""}
        photoWidth={dialogPhoto?.photoWidth}
        photoHeight={dialogPhoto?.photoHeight}
        faces={dialogPhoto?.faces.map((f) => ({ faceId: f.faceId, bbox: f.bbox, claimed: f.claimedByMe })) ?? []}
        claimingFaceId={claimingFaceId}
        onSelectFace={claim}
      />
    </div>
  );
}
