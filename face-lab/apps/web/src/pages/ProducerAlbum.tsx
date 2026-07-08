import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { AlbumSummary, PersonSummary, PhotoItem, ScanStatus } from "@face-lab/shared";
import { api } from "../api";
import { toast } from "sonner";
import { ChevronLeft, Loader2, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PhotoDialog } from "@/components/PhotoDialog";

function PhotoBadge({ photo }: { photo: PhotoItem }) {
  if (photo.status === "done") {
    return <Badge variant="secondary">{photo.faceCount} rosto{photo.faceCount === 1 ? "" : "s"}</Badge>;
  }
  if (photo.status === "error") return <Badge variant="destructive">erro</Badge>;
  return <Badge variant="outline">{photo.status === "processing" ? "processando…" : "na fila"}</Badge>;
}

export function ProducerAlbum() {
  const { id } = useParams<{ id: string }>();
  const [album, setAlbum] = useState<AlbumSummary | null>(null);
  const [status, setStatus] = useState<ScanStatus | null>(null);
  const [photos, setPhotos] = useState<PhotoItem[] | null>(null);
  const [people, setPeople] = useState<PersonSummary[]>([]);
  const [personId, setPersonId] = useState<string | null>(null);
  const [dialogPhoto, setDialogPhoto] = useState<PhotoItem | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const personRef = useRef<string | null>(null);
  personRef.current = personId;

  function loadPhotos(selectedPerson: string | null = personRef.current) {
    const qs = selectedPerson ? `?personId=${selectedPerson}` : "";
    api<PhotoItem[]>(`/api/albums/${id}/photos${qs}`).then(setPhotos).catch(() => {});
  }

  function loadPeople() {
    api<PersonSummary[]>(`/api/albums/${id}/people`).then(setPeople).catch(() => {});
  }

  function selectPerson(pid: string | null) {
    const next = pid === personId ? null : pid;
    setPersonId(next);
    loadPhotos(next);
  }

  useEffect(() => {
    api<AlbumSummary>(`/api/albums/${id}`).then(setAlbum).catch((e) => toast.error("Erro ao carregar álbum", { description: e.message }));
    loadPhotos(null);
    loadPeople();

    timer.current = setInterval(async () => {
      try {
        const s = await api<ScanStatus>(`/api/albums/${id}/scan-status`);
        setStatus(s);
        if (s.album !== "scanning") {
          loadPhotos();
          loadPeople();
          if (s.pending === 0 && timer.current) {
            clearInterval(timer.current);
            timer.current = null;
          }
        }
      } catch {
        // ignora falha de poll
      }
    }, 2500);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function scan() {
    await api(`/api/albums/${id}/scan`, { method: "POST", body: JSON.stringify({}) });
    toast.info("Escaneamento iniciado.");
    if (!timer.current) window.location.reload();
  }

  async function toggleWatermark() {
    if (!album) return;
    const next = !album.watermarkEnabled;
    setAlbum({ ...album, watermarkEnabled: next });
    try {
      await api(`/api/albums/${id}`, { method: "PATCH", body: JSON.stringify({ watermarkEnabled: next }) });
      toast.success(next ? "Marca d'água ligada." : "Marca d'água desligada.");
    } catch (err) {
      setAlbum(album); // reverte
      toast.error("Não deu pra atualizar", { description: (err as Error).message });
    }
  }

  const pct = status && status.total > 0 ? Math.round((status.done / status.total) * 100) : 0;

  return (
    <div>
      <Link to="/producer" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" />
        Voltar para Álbuns
      </Link>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="heading-editorial">{album?.name ?? "Álbum"}</h1>
        {album?.status === "archived" && <Badge variant="secondary">Arquivado</Badge>}
      </div>

      {album && (
        <label className="mt-3 flex w-fit items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" checked={album.watermarkEnabled} onChange={toggleWatermark} className="h-4 w-4" />
          Marca d'água nas miniaturas
        </label>
      )}

      {status && (
        <div className="mt-6 rounded-lg border p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {status.done}/{status.total} processadas · {status.errors} erros · {status.pending} na fila
            </p>
            <Button size="sm" onClick={scan} disabled={status.album === "scanning"}>
              {status.album === "scanning" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              {status.album === "scanning" ? "Escaneando…" : status.album === "archived" ? "Desarquivar e re-escanear" : "Re-escanear"}
            </Button>
          </div>
          <Progress value={pct} className="mt-3" />
        </div>
      )}

      {people.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
            {people.length} pessoa{people.length === 1 ? "" : "s"} no álbum
          </h2>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {people.map((pe) => (
              <button
                key={pe.id}
                type="button"
                onClick={() => selectPerson(pe.id)}
                title={`${pe.faceCount} rosto(s)`}
                className={`flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-sm transition-colors hover:bg-secondary ${
                  personId === pe.id ? "border-foreground bg-secondary" : ""
                }`}
              >
                <Avatar className="h-8 w-8">
                  {pe.coverCropUrl && <AvatarImage src={pe.coverCropUrl} alt="pessoa" />}
                  <AvatarFallback>?</AvatarFallback>
                </Avatar>
                {pe.photoCount} foto{pe.photoCount === 1 ? "" : "s"}
              </button>
            ))}
            {personId && (
              <Button variant="ghost" size="sm" onClick={() => selectPerson(null)}>
                <X className="mr-1 h-4 w-4" /> Limpar filtro
              </Button>
            )}
          </div>
        </div>
      )}

      <div className="mt-10 columns-1 gap-8 space-y-8 sm:columns-2 lg:columns-3 xl:columns-4">
        {photos?.map((p) => (
          <figure key={p.id} className="break-inside-avoid">
            <button
              type="button"
              className="block w-full cursor-zoom-in overflow-hidden bg-secondary"
              onClick={() => setDialogPhoto(p)}
              disabled={!p.thumbUrl}
            >
              {p.thumbUrl ? (
                <img src={p.thumbUrl} alt={p.name} loading="lazy" className="block h-auto w-full" />
              ) : (
                <div className="aspect-[4/3] w-full" />
              )}
            </button>
            <figcaption className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <span className="truncate">{p.name}</span>
              <PhotoBadge photo={p} />
            </figcaption>
          </figure>
        ))}
        {!photos &&
          Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="break-inside-avoid">
              <div className="aspect-[4/3] w-full animate-pulse bg-secondary/80" />
            </div>
          ))}
      </div>

      {photos && photos.length === 0 && (
        <div className="mt-8 py-20 text-center">
          <h3 className="font-medium">Nenhuma foto {personId ? "desta pessoa" : "ainda"}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {personId ? "Limpe o filtro para ver todas as fotos." : "Clique em re-escanear para buscar as fotos da pasta do Drive."}
          </p>
        </div>
      )}

      <PhotoDialog
        open={!!dialogPhoto}
        onOpenChange={(open) => !open && setDialogPhoto(null)}
        thumbUrl={dialogPhoto?.thumbUrl ?? null}
        name={dialogPhoto?.name ?? ""}
      />
    </div>
  );
}
