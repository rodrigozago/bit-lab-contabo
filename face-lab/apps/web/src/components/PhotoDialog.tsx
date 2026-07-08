import type { ReactNode } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { FaceBox, type Bbox } from "@/components/PhotoCard";

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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-0">
        <DialogTitle className="sr-only">{name}</DialogTitle>
        <div
          className="relative max-h-[78vh] overflow-hidden bg-muted"
          style={photoWidth && photoHeight ? { aspectRatio: `${photoWidth} / ${photoHeight}` } : undefined}
        >
          {thumbUrl && <img src={thumbUrl} alt={name} className="block h-full w-full object-contain" />}
          <FaceBox bbox={bbox} width={photoWidth} height={photoHeight} confirmed={confirmed} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 pb-5">
          <p className="text-sm italic text-muted-foreground">{name}</p>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
