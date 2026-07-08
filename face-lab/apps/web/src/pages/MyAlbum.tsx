import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import type { MyPhoto } from "@face-lab/shared";
import { api } from "../api";
import { toast } from "sonner";
import { Check, ChevronLeft, Download, ExternalLink, ThumbsDown, ThumbsUp } from "lucide-react";
import { PhotoCard } from "@/components/PhotoCard";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function MyAlbum() {
  const { id } = useParams<{ id: string }>();
  const [photos, setPhotos] = useState<MyPhoto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [dialogPhoto, setDialogPhoto] = useState<MyPhoto | null>(null);

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
      <h1 className="mt-4 text-3xl font-bold tracking-tight">Fotos com você</h1>
      <p className="mt-1 text-muted-foreground">O quadrado marca qual rosto achamos que é você — confirme ou corrija.</p>
      
      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
      
      <div className="mt-8 columns-1 gap-4 space-y-4 sm:columns-2 lg:columns-3 xl:columns-4">
        {photos?.map((p) => (
          <PhotoCard 
            key={p.id}
            photo={p}
            isBusy={busy === p.faceId}
            onConfirm={confirm}
            onReject={reject}
            onClick={() => setDialogPhoto(p)}
          />
        ))}
         {!photos && !error && Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="break-inside-avoid">
                <div className="aspect-[4/3] w-full animate-pulse bg-secondary/80 rounded-lg" />
            </div>
        ))}
      </div>

      {photos && photos.length === 0 && (
        <div className="mt-8 rounded-lg border border-dashed py-20 text-center">
            <h3 className="font-semibold tracking-tight">Nenhuma foto encontrada</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              As fotos deste álbum podem ter sido removidas após você rejeitar um rosto.
            </p>
        </div>
      )}

      <Dialog open={!!dialogPhoto} onOpenChange={(open) => !open && setDialogPhoto(null)}>
        <DialogContent className="max-w-4xl">
          {dialogPhoto && (
            <>
              <DialogHeader>
                <DialogTitle>{dialogPhoto.name}</DialogTitle>
              </DialogHeader>
              <div className="mt-4">
                <img src={dialogPhoto.thumbUrl ?? undefined} alt={dialogPhoto.name} className="w-full h-auto rounded-md" />
              </div>
              <div className="mt-4 flex items-center justify-center gap-2">
                {dialogPhoto.matchStatus === 'confirmed' ? (
                  <div className="flex items-center gap-2 text-sm text-green-600 font-bold px-2">
                    <Check size={16} /> Você (Confirmado)
                  </div>
                ) : (
                  <Button size="sm" disabled={busy === dialogPhoto.faceId} onClick={() => confirm(dialogPhoto.faceId)}>
                    <ThumbsUp size={16} className="mr-1" /> Sou eu
                  </Button>
                )}
                <Button size="sm" variant="outline" disabled={busy === dialogPhoto.faceId} onClick={() => reject(dialogPhoto.faceId)}>
                  <ThumbsDown size={16} className="mr-1" /> Não sou eu
                </Button>
                <div className="flex-grow" />
                {dialogPhoto.webContentLink && (
                  <Button size="icon" variant="ghost" asChild>
                    <a href={dialogPhoto.webContentLink} target="_blank" rel="noreferrer"><Download size={16} /></a>
                  </Button>
                )}
                {dialogPhoto.webViewLink && (
                  <Button size="icon" variant="ghost" asChild>
                    <a href={dialogPhoto.webViewLink} target="_blank" rel="noreferrer"><ExternalLink size={16} /></a>
                  </Button>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
