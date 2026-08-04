// Sem "server-only" de propósito — usado pelo client component OnAirClient.tsx
// (formatação de hora + a re-derivação de current/upcoming/past a cada tick
// do relógio, ver src/components/bloks/OnAirClient.tsx).
import type { OnAirSlotView } from "./types";

const TZ = "America/Sao_Paulo";

const timeFmt = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TZ,
  hour: "2-digit",
  minute: "2-digit",
});

const dayFmt = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TZ,
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
});

const clockFmt = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TZ,
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

export const fmtTime = (iso: string) => timeFmt.format(new Date(iso));
export const fmtClock = (d: Date) => clockFmt.format(d);
export const fmtDay = (iso: string) => dayFmt.format(new Date(iso));
export const fmtRange = (startIso: string, endIso: string) =>
  `${fmtTime(startIso)} – ${fmtTime(endIso)}`;

/** "@djfulano" a partir do que foi cadastrado (handle ou URL). */
export function formatInstagramHandle(raw: string): string {
  if (/^https?:\/\//i.test(raw)) {
    try {
      const seg = new URL(raw).pathname.split("/").filter(Boolean).pop();
      if (seg) return `@${seg}`;
    } catch {
      /* URL inválida: mostra como veio */
    }
    return raw;
  }
  return raw.startsWith("@") ? raw : `@${raw}`;
}

export interface SlotPartition {
  current: OnAirSlotView | null;
  upcoming: OnAirSlotView[];
  past: OnAirSlotView[];
}

/** Porte puro da lógica SQL original (on-air/apps/api/src/db.ts `stmts`):
 * current = starts <= now < ends (no máximo um, sobreposição nunca existiu
 * no cadastro original); upcoming = futuros crescente; past = encerrados
 * decrescente. Roda de novo a cada tick do relógio no client — o array já
 * veio inteiro do server, então não tem custo de rede, só um filter/sort
 * sobre no máximo ~100 itens. */
export function partitionSlots(all: OnAirSlotView[], now: Date): SlotPartition {
  const nowMs = now.getTime();
  let current: OnAirSlotView | null = null;
  const upcoming: OnAirSlotView[] = [];
  const past: OnAirSlotView[] = [];

  for (const slot of all) {
    const starts = new Date(slot.startsAtIso).getTime();
    const ends = new Date(slot.endsAtIso).getTime();
    if (starts <= nowMs && nowMs < ends) {
      if (!current || starts < new Date(current.startsAtIso).getTime()) current = slot;
    } else if (starts > nowMs) {
      upcoming.push(slot);
    } else {
      past.push(slot);
    }
  }

  upcoming.sort((a, b) => new Date(a.startsAtIso).getTime() - new Date(b.startsAtIso).getTime());
  past.sort((a, b) => new Date(b.endsAtIso).getTime() - new Date(a.endsAtIso).getTime());

  return { current, upcoming, past };
}
