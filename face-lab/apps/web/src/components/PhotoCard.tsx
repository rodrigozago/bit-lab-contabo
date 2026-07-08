import type { MyPhoto } from "@face-lab/shared";
import { Check, Download, ExternalLink, ThumbsDown, ThumbsUp, X } from "lucide-react";
import { Button } from "./ui/button";

function FaceBox({ photo }: { photo: MyPhoto }) {
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

export function PhotoCard({ photo, isBusy, onConfirm, onReject, onClick }: PhotoCardProps) {
  const isConfirmed = photo.matchStatus === "confirmed";

  return (
    <div 
      className="group relative break-inside-avoid overflow-hidden rounded-lg cursor-pointer"
      onClick={onClick}
    >
      <img
        src={photo.thumbUrl}
        alt={photo.name}
        width={photo.photoWidth}
        height={photo.photoHeight}
        className="w-full h-auto"
        loading="lazy"
      />
      <FaceBox photo={photo} />

      {/* Overlay + Actions, visible on hover/group-hover */}
      <div className="absolute inset-0 bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
        <div className="absolute bottom-0 left-0 w-full p-2">
          <div className="flex items-center justify-center gap-1 rounded-md bg-background/80 p-1 backdrop-blur-sm">
            {isConfirmed ? (
               <div className="flex items-center gap-2 text-sm text-green-600 font-bold px-2">
                <Check size={16} /> Você
              </div>
            ) : (
              <Button size="sm" variant="ghost" disabled={isBusy} onClick={(e) => { e.stopPropagation(); onConfirm(photo.faceId); }}>
                <ThumbsUp size={16} className="mr-1" /> Sou eu
              </Button>
            )}
             <Button size="sm" variant="ghost" disabled={isBusy} onClick={(e) => { e.stopPropagation(); onReject(photo.faceId); }}>
                <ThumbsDown size={16} className="mr-1" /> Não sou eu
            </Button>
            
            <div className="flex-grow" />

            {photo.webContentLink && (
              <Button size="icon" variant="ghost" asChild>
                <a href={photo.webContentLink} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                  <Download size={16} />
                </a>
              </Button>
            )}
            {photo.webViewLink && (
              <Button size="icon" variant="ghost" asChild>
                <a href={photo.webViewLink} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                  <ExternalLink size={16} />
                </a>
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
