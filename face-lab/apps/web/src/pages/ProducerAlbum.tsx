import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { AlbumSummary, PersonSummary, PhotoItem, ScanStatus } from "@face-lab/shared";
import { api } from "../api";
import { toast } from "sonner";
import { ChevronLeft, Loader2, RefreshCw, Sparkles, Star, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  const [confirmWatermark, setConfirmWatermark] = useState(false);
  const [watermarkBusy, setWatermarkBusy] = useState(false);
  const [featuredBusy, setFeaturedBusy] = useState(false);
  const [processingClean, setProcessingClean] = useState(false);
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

  // checkbox só abre a confirmação — nada muda até o producer confirmar. Se
  // não há foto processada ainda, não há o que reprocessar: aplica direto.
  function requestToggleWatermark() {
    if (!album) return;
    if (album.doneCount === 0) return void applyWatermarkToggle(!album.watermarkEnabled);
    setConfirmWatermark(true);
  }

  async function applyWatermarkToggle(next: boolean) {
    if (!album) return;
    setWatermarkBusy(true);
    const prev = album;
    setAlbum({ ...album, watermarkEnabled: next });
    try {
      await api(`/api/albums/${id}`, { method: "PATCH", body: JSON.stringify({ watermarkEnabled: next }) });
      // a marca d'água é bakeada no arquivo — as miniaturas já processadas são
      // rebatidas em segundo plano (baixa de novo do Drive), não é instantâneo
      toast.success(
        next ? "Marca d'água ligada." : "Marca d'água desligada.",
        { description: "As miniaturas já processadas vão atualizar em instantes." }
      );
    } catch (err) {
      setAlbum(prev); // reverte
      toast.error("Não deu pra atualizar", { description: (err as Error).message });
    } finally {
      setWatermarkBusy(false);
      setConfirmWatermark(false);
    }
  }

  // exibir/ocultar o álbum no portfólio público (/p/:slug)
  async function toggleFeaturedAlbum(next: boolean) {
    if (!album) return;
    setFeaturedBusy(true);
    const prev = album;
    setAlbum({ ...album, featured: next });
    try {
      await api(`/api/albums/${id}`, { method: "PATCH", body: JSON.stringify({ featured: next }) });
      toast.success(next ? "Álbum publicado no portfólio." : "Álbum removido do portfólio.");
    } catch (err) {
      setAlbum(prev);
      toast.error("Não deu pra atualizar", { description: (err as Error).message });
    } finally {
      setFeaturedBusy(false);
    }
  }

  // marca/desmarca a foto como destaque do portfólio (otimista)
  async function toggleFeaturedPhoto(photo: PhotoItem) {
    const next = !photo.featured;
    setPhotos((ps) => ps?.map((p) => (p.id === photo.id ? { ...p, featured: next, hasCleanThumb: next && p.hasCleanThumb } : p)) ?? null);
    setAlbum((a) => (a ? { ...a, featuredPhotoCount: a.featuredPhotoCount + (next ? 1 : -1) } : a));
    try {
      await api(`/api/albums/${id}/photos/${photo.id}/feature`, {
        method: "POST",
        body: JSON.stringify({ featured: next }),
      });
    } catch (err) {
      setPhotos((ps) => ps?.map((p) => (p.id === photo.id ? { ...p, featured: photo.featured, hasCleanThumb: photo.hasCleanThumb } : p)) ?? null);
      setAlbum((a) => (a ? { ...a, featuredPhotoCount: a.featuredPhotoCount + (next ? -1 : 1) } : a));
      toast.error("Não deu pra atualizar destaque", { description: (err as Error).message });
    }
  }

  async function processFeatured() {
    setProcessingClean(true);
    try {
      await api(`/api/albums/${id}/process-featured`, { method: "POST", body: JSON.stringify({}) });
      toast.success("Processando destaques sem marca d'água.", {
        description: "As fotos aparecem limpas no portfólio em instantes.",
      });
      setTimeout(() => loadPhotos(), 5000);
    } catch (err) {
      toast.error("Não deu pra processar", { description: (err as Error).message });
    } finally {
      setProcessingClean(false);
    }
  }

  const featuredCount = album?.featuredPhotoCount ?? 0;
  const pendingClean = photos?.filter((p) => p.featured && !p.hasCleanThumb).length ?? 0;
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
        <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2">
          <label className="flex w-fit items-center gap-2 text-sm text-muted-foreground">
            <Checkbox
              checked={album.watermarkEnabled}
              onCheckedChange={requestToggleWatermark}
              disabled={watermarkBusy}
            />
            Marca d'água nas miniaturas
          </label>
          <label className="flex w-fit items-center gap-2 text-sm text-muted-foreground">
            <Checkbox
              checked={album.featured}
              onCheckedChange={(v) => toggleFeaturedAlbum(v === true)}
              disabled={featuredBusy}
            />
            Exibir no portfólio público
          </label>
        </div>
      )}

      {/* barra de destaques: contador + processamento sem marca d'água */}
      {album?.featured && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border bg-secondary/50 p-4">
          <p className="text-sm text-muted-foreground">
            <Star className="mr-1 inline h-4 w-4 text-accent" />
            {featuredCount} foto{featuredCount === 1 ? "" : "s"} em destaque no portfólio
            {pendingClean > 0 && ` · ${pendingClean} aguardando versão sem marca d'água`}
          </p>
          <Button size="sm" variant="outline" onClick={processFeatured} disabled={processingClean || pendingClean === 0}>
            {processingClean ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            Processar sem marca d'água
          </Button>
        </div>
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
                className={`flex items-center gap-2 rounded-none border py-1 pl-1 pr-3 text-sm transition-colors hover:bg-secondary ${
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
            <figcaption className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
              {p.status === "done" && (
                <Button
                  size="icon-sm"
                  variant="ghost"
                  title={p.featured ? "Remover destaque do portfólio" : "Destacar no portfólio"}
                  onClick={() => toggleFeaturedPhoto(p)}
                >
                  <Star size={14} className={p.featured ? "fill-accent text-accent" : ""} />
                </Button>
              )}
              <span className="min-w-0 flex-1 truncate">{p.name}</span>
              {p.featured && p.hasCleanThumb && <Badge variant="premium">sem marca</Badge>}
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

      <Dialog open={confirmWatermark} onOpenChange={(open) => !watermarkBusy && setConfirmWatermark(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{album?.watermarkEnabled ? "Desligar" : "Ligar"} marca d'água?</DialogTitle>
            <DialogDescription>
              As {album?.doneCount} foto{album?.doneCount === 1 ? "" : "s"} já processada{album?.doneCount === 1 ? "" : "s"} deste
              álbum vão ser analisadas de novo pra atualizar a miniatura. No futuro isso vai consumir créditos da sua conta.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" disabled={watermarkBusy} onClick={() => setConfirmWatermark(false)}>
              Cancelar
            </Button>
            <Button disabled={watermarkBusy} onClick={() => applyWatermarkToggle(!album?.watermarkEnabled)}>
              {watermarkBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
