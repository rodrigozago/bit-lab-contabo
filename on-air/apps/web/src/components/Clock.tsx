import { useEffect, useState } from 'react'
import { fmtClock } from '../lib/time'

export default function Clock() {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    // 250ms pra virada do segundo nunca "pular" visualmente
    const timer = setInterval(() => setNow(new Date()), 250)
    return () => clearInterval(timer)
  }, [])

  const text = fmtClock(now) // "22:05:09"
  const hm = text.slice(0, 5)
  const ss = text.slice(5) // ":09"

  return (
    <time className="font-black leading-none tabular-nums">
      <span className="text-5xl sm:text-6xl lg:text-7xl">{hm}</span>
      <span className="text-3xl text-accent-bright sm:text-4xl lg:text-5xl">{ss}</span>
    </time>
  )
}
