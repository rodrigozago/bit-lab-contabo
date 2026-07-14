import type { ReactNode } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { FaceBox } from "@/components/PhotoCard";
import type { Bbox, MyPhoto } from "@face-lab/shared";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface SelectableFace {
  faceId: string;
  bbox: Bbox;
  claimed: boolean;
}

// bbox clicável — usado no modo "seleção" (autoidentificação com múltiplos rostos)
function ClickableFaceBox({
  face,
  width,
  height,
  busy,
  onSelect,
}: {
  face: SelectableFace;
  width: number;
  height: number;
  busy: boolean;
  onSelect?: (faceId: string) => void;
}) {
  return (
    <button
      type="button"
      disabled={face.claimed || busy}
      onClick={() => onSelect?.(face.faceId)}
      className={cn(
        "group absolute border-2 transition-colors",
        face.claimed ? "cursor-default border-accent bg-accent/10" : "cursor-pointer border-accent-secondary/70 hover:bg-accent-secondary/10"
      )}
      style={{
        left: `${(face.bbox.x / width) * 100}%`,
        top: `${(face.bbox.y / height) * 100}%`,
        width: `${(face.bbox.w / width) * 100}%`,
        height: `${(face.bbox.h / height) * 100}%`,
      }}
      title={face.claimed ? "já é você" : "marcar como você"}
    >
      {busy && !face.claimed && (
        <Loader2 className="absolute inset-0 m-auto h-5 w-5 animate-spin text-primary" />
      )}
    </button>
  );
}

interface PhotoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  thumbUrl: string | null;
  name: string;
  photoWidth?: number | null;
  photoHeight?: number | null;
  bbox?: Bbox | null;
  confirmed?: boolean;
  actions?: ReactNode;
  // modo seleção (autoidentificação, "Todas as fotos"): várias faces clicáveis
  // em vez do bbox único read-only acima
  faces?: SelectableFace[];
  onSelectFace?: (faceId: string) => void;
  claimingFaceId?: string | null;
}

/** Detalhe da foto: imagem grande centrada + legenda + ações (ref image-details). */
export function PhotoDialog({
  open,
  onOpenChange,
  thumbUrl,
  name,
  photoWidth,
  photoHeight,
  bbox,
  confirmed,
  actions,
  faces,
  onSelectFace,
  claimingFaceId,
}: PhotoDialogProps) {
  const photo: Partial<MyPhoto> = {
    faceBbox: bbox,
    photoWidth: photoWidth,
    photoHeight: photoHeight,
    matchStatus: confirmed ? "confirmed" : "auto",
  };
  const selectionMode = faces !== undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* sem moldura — a foto fica "pura" (ref image-details.jpg), só a sombra separa do overlay */}
      <DialogContent className="max-w-4xl gap-0 rounded-none border-0 p-0 shadow-2xl">
        <DialogTitle className="sr-only">{name}</DialogTitle>
        {/*
          container encolhe pro tamanho REAL da imagem renderizada (flex + w-fit) em vez de um
          aspect-ratio fixo — em foto retrato limitada por max-h isso deixava espaço vazio no
          container e o bbox (absolute, % relativo ao container) descolava da imagem
        */}
        <div className="relative mx-auto flex w-fit max-w-full items-center justify-center bg-muted" style={{ maxHeight: "78vh" }}>
          {thumbUrl && <img src={thumbUrl} alt={name} className="block max-h-[78vh] w-auto max-w-full object-contain" />}
          {selectionMode
            ? photoWidth &&
              photoHeight &&
              faces.map((f) => (
                <ClickableFaceBox
                  key={f.faceId}
                  face={f}
                  width={photoWidth}
                  height={photoHeight}
                  busy={claimingFaceId === f.faceId}
                  onSelect={onSelectFace}
                />
              ))
            : <FaceBox photo={photo as MyPhoto} />}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 pb-5">
          <p className="text-sm italic text-muted-foreground">
            {selectionMode ? "Clique no seu rosto pra marcar \"Sou eu\"" : name}
          </p>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
