import type { ReactNode } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { FaceBox } from "@/components/PhotoCard";
import type { Bbox, MyPhoto } from "@face-lab/shared";

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
}: PhotoDialogProps) {
  const photo: Partial<MyPhoto> = {
    faceBbox: bbox,
    photoWidth: photoWidth,
    photoHeight: photoHeight,
    matchStatus: confirmed ? "confirmed" : "auto",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* sem moldura — a foto fica "pura" (ref image-details.jpg), só a sombra separa do overlay */}
      <DialogContent className="max-w-4xl gap-0 rounded-none border-0 p-0 shadow-2xl">
        <DialogTitle className="sr-only">{name}</DialogTitle>
        <div
          className="relative overflow-hidden bg-muted"
          style={photoWidth && photoHeight ? { aspectRatio: `${photoWidth} / ${photoHeight}` } : undefined}
        >
          {thumbUrl && <img src={thumbUrl} alt={name} className="block max-h-[78vh] w-full object-contain" />}
          <FaceBox photo={photo as MyPhoto} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 pb-5">
          <p className="text-sm italic text-muted-foreground">{name}</p>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
