import type { MyPhoto } from "@face-lab/shared";
import { Check, Download, ExternalLink, ThumbsDown, ThumbsUp } from "lucide-react";
import { Button } from "./ui/button";

export function FaceBox({ photo }: { photo: MyPhoto }) {
  const { faceBbox: b, photoWidth: w, photoHeight: h } = photo;
  if (!b || !w || !h) return null;
  const confirmed = photo.matchStatus === "confirmed";
  return (
    <div
      className={`absolute border-2 box-content pointer-events-none
        ${confirmed ? "border-green-500" : "border-primary"}`}
      style={{
        left: `${(b.x / w) * 100}%`,
        top: `${(b.y / h) * 100}%`,
        width: `${(b.w / w) * 100}%`,
        height: `${(b.h / h) * 100}%`,
      }}
    />
  );
}

interface PhotoCardProps {
  photo: MyPhoto;
  isBusy: boolean;
  onConfirm: (faceId: string) => void;
  onReject: (faceId: string) => void;
  onClick: () => void;
}

// tile plano — imagem sem moldura (ref gallery.jpg) + barra de legenda/ações
// abaixo, sempre visível (não depende de hover, funciona em touch)
export function PhotoCard({ photo, isBusy, onConfirm, onReject, onClick }: PhotoCardProps) {
  const isConfirmed = photo.matchStatus === "confirmed";

  return (
    <figure className="break-inside-avoid">
      <button type="button" className="block w-full cursor-zoom-in overflow-hidden bg-secondary" onClick={onClick}>
        <img
          src={photo.thumbUrl ?? undefined}
          alt={photo.name}
          width={photo.photoWidth ?? undefined}
          height={photo.photoHeight ?? undefined}
          className="block h-auto w-full"
          loading="lazy"
        />
        <FaceBox photo={photo} />
      </button>

      <figcaption className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
        {isConfirmed ? (
          <span className="flex items-center gap-1 font-medium text-ok">
            <Check size={13} /> Você
          </span>
        ) : (
          <Button
            size="icon-sm"
            variant="ghost"
            disabled={isBusy}
            title="Sou eu"
            onClick={(e) => {
              e.stopPropagation();
              onConfirm(photo.faceId);
            }}
          >
            <ThumbsUp size={14} />
          </Button>
        )}
        <Button
          size="icon-sm"
          variant="ghost"
          disabled={isBusy}
          title="Não sou eu"
          onClick={(e) => {
            e.stopPropagation();
            onReject(photo.faceId);
          }}
        >
          <ThumbsDown size={14} />
        </Button>

        <span className="flex-1" />

        {photo.webContentLink && (
          <Button size="icon-sm" variant="ghost" asChild title="Baixar">
            <a href={photo.webContentLink} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
              <Download size={14} />
            </a>
          </Button>
        )}
        {photo.webViewLink && (
          <Button size="icon-sm" variant="ghost" asChild title="Ver no Drive">
            <a href={photo.webViewLink} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
              <ExternalLink size={14} />
            </a>
          </Button>
        )}
      </figcaption>
    </figure>
  );
}
