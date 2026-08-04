import { fmtClock } from "@/lib/onair-format";

/** Recebe `now` de fora (OnAirClient.tsx já tem um tick de 250ms rodando pra
 * reparticionar os slots) em vez de manter o próprio timer — um só relógio
 * mestre pra tela inteira. */
export function Clock({ now }: { now: Date }) {
  const text = fmtClock(now); // "22:05:09"
  const hm = text.slice(0, 5);
  const ss = text.slice(5); // ":09"

  return (
    <time className="font-black leading-none tabular-nums">
      <span className="text-5xl sm:text-6xl lg:text-7xl">{hm}</span>
      <span className="text-3xl text-accent-bright sm:text-4xl lg:text-5xl">{ss}</span>
    </time>
  );
}
