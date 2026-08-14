import { storyblokEditable } from "@storyblok/react/rsc";
import type { StudioCalendarBlok, StudioEventStoryContent } from "@/lib/types";
import { fetchStories } from "@/lib/storyblok";
import { spWallToUtcIso } from "@/lib/onair-time";

interface EventView {
  uid: string;
  title: string;
  labelName?: string;
  location?: string;
  link?: string;
  startsAtIso: string;
}

/** Calendário de próximos eventos/showcases dos labels do studio. Busca
 * sozinho via content_type "studio_event" (pasta studio-events/, fora de
 * studio/ — mesmo padrão de on-air-slots/: nunca é buscada por slug
 * individual). starts_at é Date/Time do Storyblok = horário de parede de
 * São Paulo, mesma conversão que o on-air já usa (spWallToUtcIso). */
export async function StudioCalendar({ blok }: { blok: StudioCalendarBlok }) {
  const theme = blok.theme ?? "dark";
  const stories = await fetchStories<StudioEventStoryContent>({
    content_type: "studio_event",
    starts_with: "studio-events/",
    sort_by: "content.starts_at:asc",
  });

  const now = new Date().getTime();
  const events: EventView[] = stories
    .map((story): EventView | null => {
      const { title, label_name, location, link, starts_at } = story.content;
      if (!title || !starts_at) return null;
      const startsAtIso = spWallToUtcIso(starts_at);
      if (!startsAtIso) return null;
      return { uid: story.uuid, title, labelName: label_name, location, link, startsAtIso };
    })
    .filter((e): e is EventView => e !== null && new Date(e.startsAtIso).getTime() >= now)
    .sort((a, b) => a.startsAtIso.localeCompare(b.startsAtIso));

  const formatter = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <section
      id="calendario"
      {...storyblokEditable(blok)}
      className={`theme--${theme} section-pad py-24 md:py-32`}
    >
      {blok.heading && <h2 className="text-heading mb-16">{blok.heading}</h2>}

      {events.length === 0 ? (
        <p className="text-body text-fg-muted">Nada marcado por enquanto — volta em breve.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {events.map((event) => {
            const card = (
              <div className="grid-12 items-center py-8">
                <span className="text-label col-span-3 text-accent md:col-span-2">
                  {formatter.format(new Date(event.startsAtIso))}
                </span>
                <span className="text-heading col-span-9 md:col-span-7">{event.title}</span>
                <span className="text-label col-span-12 text-fg-muted md:col-span-3 md:text-right">
                  {[event.labelName, event.location].filter(Boolean).join(" · ")}
                </span>
              </div>
            );
            return (
              <li key={event.uid}>
                {event.link ? (
                  <a href={event.link} className="block hover:opacity-70">
                    {card}
                  </a>
                ) : (
                  card
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
