import type { Slot } from '../types'
import { fmtDay, fmtRange } from '../lib/time'

function Row({ slot, highlight, dim }: { slot: Slot; highlight?: boolean; dim?: boolean }) {
  return (
    <li
      className={`flex items-center gap-4 rounded-xl border bg-surface px-4 py-3 ${
        highlight ? 'border-accent-bright' : 'border-edge'
      } ${dim ? 'opacity-50' : ''}`}
    >
      {slot.image_url ? (
        <img
          src={slot.image_url}
          alt={slot.artist}
          className="h-11 w-11 shrink-0 rounded-full object-cover"
        />
      ) : (
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent font-black">
          {slot.artist.charAt(0).toUpperCase()}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate font-bold">{slot.artist}</p>
        <p className="truncate text-sm text-muted">{slot.genre}</p>
      </div>
      <div className="shrink-0 text-right text-sm tabular-nums text-muted">
        <p className="capitalize">{fmtDay(slot.starts_at)}</p>
        <p>{fmtRange(slot.starts_at, slot.ends_at)}</p>
      </div>
    </li>
  )
}

export default function Timetable({ upcoming, past }: { upcoming: Slot[]; past: Slot[] }) {
  return (
    <section className="mx-auto w-full max-w-2xl space-y-8 lg:mx-0 lg:max-w-none">
      <div>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.3em] text-muted">
          A seguir
        </h2>
        {upcoming.length > 0 ? (
          <ul className="space-y-2">
            {upcoming.map((slot, i) => (
              <Row key={slot.id} slot={slot} highlight={i === 0} />
            ))}
          </ul>
        ) : (
          <p className="rounded-xl border border-dashed border-edge px-4 py-3 text-sm text-muted">
            Nada agendado ainda.
          </p>
        )}
      </div>
      {past.length > 0 && (
        <div>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.3em] text-muted">
            Já tocaram
          </h2>
          <ul className="space-y-2">
            {past.map((slot) => (
              <Row key={slot.id} slot={slot} dim />
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
