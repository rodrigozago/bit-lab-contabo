import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface Bbox {
  x: number;
  y: number;
  w: number;
  h: number;
}

// quadrado sobre o rosto — coords em % da foto original
export function FaceBox({
  bbox,
  width,
  height,
  confirmed,
}: {
  bbox: Bbox | null | undefined;
  width: number | null | undefined;
  height: number | null | undefined;
  confirmed?: boolean;
}) {
  if (!bbox || !width || !height) return null;
  return (
    <div
      className={cn("face-box", confirmed && "confirmed")}
      style={{
        left: `${(bbox.x / width) * 100}%`,
        top: `${(bbox.y / height) * 100}%`,
        width: `${(bbox.w / width) * 100}%`,
        height: `${(bbox.h / height) * 100}%`,
      }}
    />
  );
}

interface PhotoCardProps {
  thumbUrl: string | null;
  alt: string;
  photoWidth?: number | null;
  photoHeight?: number | null;
  bbox?: Bbox | null;
  confirmed?: boolean;
  onOpen?: () => void;
  footer?: ReactNode; // barra de ações/badges sob a imagem
}

/** Card de foto do grid masonry — imagem limpa em proporção natural + bbox opcional. */
export function PhotoCard({ thumbUrl, alt, photoWidth, photoHeight, bbox, confirmed, onOpen, footer }: PhotoCardProps) {
  return (
    <figure className="group mb-5 break-inside-avoid">
      <button
        type="button"
        onClick={onOpen}
        className={cn("relative block w-full overflow-hidden bg-muted", onOpen && "cursor-zoom-in")}
        style={photoWidth && photoHeight ? { aspectRatio: `${photoWidth} / ${photoHeight}` } : undefined}
        disabled={!onOpen}
      >
        {thumbUrl && <img src={thumbUrl} alt={alt} loading="lazy" className="block h-auto w-full" />}
        <FaceBox bbox={bbox} width={photoWidth} height={photoHeight} confirmed={confirmed} />
      </button>
      {footer && <figcaption className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">{footer}</figcaption>}
    </figure>
  );
}
