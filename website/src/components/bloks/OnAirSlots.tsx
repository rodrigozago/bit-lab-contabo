import { storyblokEditable } from "@storyblok/react/rsc";
import type { OnAirBlok, OnAirSlotStoryContent } from "@/lib/types";
import { fetchStories } from "@/lib/storyblok";
import { toOnAirSlotView } from "@/lib/onair-time";
import { OnAirClient } from "./OnAirClient";

const ENDED_LIMIT = 20; // mesmo LIMIT 20 do `past` no schema original

/** Blok server "on_air" — busca todas as stories `on_air_slot` da pasta
 * `on-air-slots/`, converte o fuso de cada uma (src/lib/onair-time.ts) e
 * manda só o essencial, já serializável, pro client component. Mesmo
 * padrão do ProjectIndex.tsx: o blok se vira sozinho, não recebe a lista
 * por campo do Storyblok. */
export async function OnAirSlots({ blok }: { blok: OnAirBlok }) {
  const stories = await fetchStories<OnAirSlotStoryContent>({
    content_type: "on_air_slot",
    starts_with: "on-air-slots/",
    per_page: 100,
  });

  const now = new Date();
  const nowMs = now.getTime();

  const allSlots = stories.map(toOnAirSlotView).filter((slot) => slot !== null);
  const active = allSlots.filter((slot) => new Date(slot.endsAtIso).getTime() > nowMs);
  const ended = allSlots
    .filter((slot) => new Date(slot.endsAtIso).getTime() <= nowMs)
    .sort((a, b) => new Date(b.endsAtIso).getTime() - new Date(a.endsAtIso).getTime())
    .slice(0, ENDED_LIMIT); // mesmo LIMIT 20 do `past` original

  const slots = [...active, ...ended];

  return (
    <div {...storyblokEditable(blok)}>
      <OnAirClient slots={slots} initialNowIso={now.toISOString()} />
    </div>
  );
}
