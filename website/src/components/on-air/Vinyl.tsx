import Image from "next/image";
import type { OnAirSlotView } from "@/lib/types";
import { fmtTime } from "@/lib/onair-format";

const GROOVES =
  "repeating-radial-gradient(circle at center, #0b0b0d 0px, #0b0b0d 2px, #17171c 2.5px, #0b0b0d 4px)";
const SHEEN =
  "conic-gradient(from 210deg, transparent 0deg, rgba(255,255,255,0.07) 30deg, transparent 65deg, transparent 180deg, rgba(255,255,255,0.05) 215deg, transparent 250deg)";

export function Vinyl({ slot }: { slot: OnAirSlotView | null }) {
  return (
    <div className="flex items-center gap-3 sm:gap-5">
      {/* horários flanqueando o disco, fora do elemento que gira */}
      <span className="w-11 shrink-0 text-right text-sm tabular-nums text-muted">
        {slot ? fmtTime(slot.startsAtIso) : "--:--"}
      </span>

      <div className="relative aspect-square w-64 shrink-0 sm:w-80 lg:w-[420px]">
        <div
          className={`absolute inset-0 rounded-full shadow-[0_25px_70px_rgba(0,0,0,0.65)] ring-1 ring-white/10 vinyl-spin ${
            slot ? "" : "vinyl-spin-paused opacity-70"
          }`}
          style={{ background: GROOVES }}
        >
          <div className="absolute inset-0 rounded-full" style={{ background: SHEEN }} />

          {/* selo central — a foto gira junto com o disco */}
          <div className="absolute left-1/2 top-1/2 h-[38%] w-[38%] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full ring-4 ring-black/70">
            {slot?.photoUrl ? (
              <Image
                src={slot.photoUrl}
                alt={slot.photoAlt || slot.artist}
                fill
                sizes="(min-width: 1024px) 160px, (min-width: 640px) 120px, 96px"
                className="object-cover"
                draggable={false}
              />
            ) : slot ? (
              <div className="flex h-full w-full items-center justify-center bg-accent text-5xl font-black text-foreground">
                {slot.artist.charAt(0).toUpperCase()}
              </div>
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-surface text-xs font-bold uppercase tracking-[0.25em] text-muted">
                Off air
              </div>
            )}
          </div>

          {/* furo do disco */}
          <div className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-background ring-1 ring-black/80" />
        </div>
      </div>

      <span className="w-11 shrink-0 text-left text-sm tabular-nums text-muted">
        {slot ? fmtTime(slot.endsAtIso) : "--:--"}
      </span>
    </div>
  );
}
