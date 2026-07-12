import { QRCodeSVG } from 'qrcode.react'
import type { Slot } from '../types'
import Vinyl from './Vinyl'
import { fmtRange } from '../lib/time'

/** "@djfulano" a partir do que foi cadastrado (handle ou URL) */
function instagramHandle(raw: string): string {
  if (/^https?:\/\//i.test(raw)) {
    try {
      const seg = new URL(raw).pathname.split('/').filter(Boolean).pop()
      if (seg) return `@${seg}`
    } catch {
      /* URL inválida: mostra como veio */
    }
    return raw
  }
  return raw.startsWith('@') ? raw : `@${raw}`
}

export default function NowPlaying({ slot }: { slot: Slot | null }) {
  return (
    <section className="flex flex-col items-center gap-10 lg:flex-row lg:justify-center lg:gap-20">
      <Vinyl slot={slot} />

      <div className="max-w-md text-center lg:text-left">
        {slot ? (
          <>
            <div className="mb-4 flex items-center justify-center gap-2.5 lg:justify-start">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-accent-bright" />
              <span className="text-xs font-semibold uppercase tracking-[0.35em] text-accent-bright">
                Ao vivo
              </span>
            </div>
            <h1 className="text-4xl font-black leading-tight sm:text-6xl">{slot.artist}</h1>
            <span className="mt-5 inline-block rounded-full bg-accent px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-foreground">
              {slot.genre}
            </span>
            <p className="mt-5 text-xl tabular-nums text-muted">
              {fmtRange(slot.starts_at, slot.ends_at)}
            </p>
            {slot.instagram_url && (
              <div className="mt-7 flex items-center justify-center gap-4 lg:justify-start">
                {/* fundo branco pro QR escanear bem no tema escuro */}
                <div className="shrink-0 rounded-xl bg-white p-2.5">
                  <QRCodeSVG value={slot.instagram_url} size={112} fgColor="#060b1d" bgColor="#ffffff" />
                </div>
                <div className="text-left">
                  <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted">
                    Segue o DJ
                  </p>
                  <p className="mt-1 font-bold text-accent-bright">
                    {instagramHandle(slot.instagram ?? slot.instagram_url)}
                  </p>
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            <h1 className="text-3xl font-black text-muted sm:text-5xl">
              Ninguém tocando agora
            </h1>
            <p className="mt-4 text-muted">Confira os próximos horários abaixo.</p>
          </>
        )}
      </div>
    </section>
  )
}
