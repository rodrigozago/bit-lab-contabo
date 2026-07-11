const TZ = 'America/Sao_Paulo'

const timeFmt = new Intl.DateTimeFormat('pt-BR', {
  timeZone: TZ,
  hour: '2-digit',
  minute: '2-digit',
})

const dayFmt = new Intl.DateTimeFormat('pt-BR', {
  timeZone: TZ,
  weekday: 'short',
  day: '2-digit',
  month: '2-digit',
})

const clockFmt = new Intl.DateTimeFormat('pt-BR', {
  timeZone: TZ,
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
})

export const fmtTime = (iso: string) => timeFmt.format(new Date(iso))
export const fmtClock = (d: Date) => clockFmt.format(d)
export const fmtDay = (iso: string) => dayFmt.format(new Date(iso))
export const fmtRange = (startIso: string, endIso: string) =>
  `${fmtTime(startIso)} – ${fmtTime(endIso)}`
