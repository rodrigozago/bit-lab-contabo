import { useCallback, useEffect, useState } from 'react'
import { getTimetable } from '../api'
import type { TimetableResponse } from '../types'
import Clock from '../components/Clock'
import NowPlaying from '../components/NowPlaying'
import Timetable from '../components/Timetable'

export default function Home() {
  const [data, setData] = useState<TimetableResponse | null>(null)
  const [failed, setFailed] = useState(false)

  const load = useCallback(async () => {
    try {
      setData(await getTimetable())
      setFailed(false)
    } catch {
      setFailed(true)
    }
  }, [])

  useEffect(() => {
    void load()
    const interval = setInterval(() => void load(), 30_000)
    const onVisible = () => {
      if (!document.hidden) void load()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [load])

  // timer exato na virada de slot (fim do atual ou início do próximo) — o poll
  // de 30s é o fallback; isso aqui faz a troca acontecer na hora certa
  useEffect(() => {
    if (!data) return
    const boundary = data.current?.ends_at ?? data.upcoming[0]?.starts_at
    if (!boundary) return
    const ms = new Date(boundary).getTime() - Date.now() + 500
    if (ms <= 0) return
    const timer = setTimeout(() => void load(), ms)
    return () => clearTimeout(timer)
  }, [data, load])

  return (
    <main className="mx-auto flex min-h-dvh max-w-[1800px] flex-col gap-12 px-4 py-10 sm:py-12 lg:px-12">
      <header className="flex flex-col items-center gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-center gap-3 lg:pt-4">
          <span className="h-3 w-3 rounded-full bg-accent" />
          <span className="text-sm font-bold uppercase tracking-[0.4em]">On Air</span>
        </div>
        <Clock />
      </header>

      {failed && !data ? (
        <p className="text-center text-muted">Não consegui carregar a programação — tentando de novo…</p>
      ) : data ? (
        // monitor landscape: disco+info à esquerda, timetable como coluna à direita
        <div className="flex flex-1 flex-col gap-16 lg:flex-row lg:items-center lg:gap-16">
          <div className="flex flex-1 justify-center">
            <NowPlaying slot={data.current} />
          </div>
          <aside className="w-full lg:max-h-[75vh] lg:w-[440px] lg:shrink-0 lg:overflow-y-auto lg:pr-1">
            <Timetable upcoming={data.upcoming} past={data.past} />
          </aside>
        </div>
      ) : (
        <p className="text-center text-muted">Carregando…</p>
      )}

      <footer className="mt-auto text-center text-xs text-muted/60">
        bit-lab · horários em Brasília (GMT-3)
      </footer>
    </main>
  )
}
