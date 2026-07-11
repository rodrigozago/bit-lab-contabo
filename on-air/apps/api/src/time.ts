// Regra do fuso: SQLite guarda UTC; admin edita e público vê America/Sao_Paulo.
// Nunca `new Date('YYYY-MM-DDTHH:mm')` — parseia no fuso da máquina, e o
// container roda em UTC enquanto o browser do admin pode estar em qualquer lugar.

const TZ = 'America/Sao_Paulo'

const partsFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
})

function spParts(utc: Date): Record<string, string> {
  const out: Record<string, string> = {}
  for (const { type, value } of partsFmt.formatToParts(utc)) out[type] = value
  if (out['hour'] === '24') out['hour'] = '00'
  return out
}

/** Epoch "fake" tratando a parede SP como se fosse UTC — serve pra medir o offset. */
function wallEpoch(utc: Date): number {
  const p = spParts(utc)
  return Date.UTC(
    Number(p['year']),
    Number(p['month']) - 1,
    Number(p['day']),
    Number(p['hour']),
    Number(p['minute']),
    Number(p['second'])
  )
}

/** 'YYYY-MM-DDTHH:mm' (parede em São Paulo, vindo do <input datetime-local>) → ISO UTC. */
export function spWallToUtcIso(local: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local)
  if (!m) throw new Error(`datetime inválido (esperado YYYY-MM-DDTHH:mm): ${local}`)
  const wall = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]))
  // Chute inicial: UTC == parede. O erro do chute é exatamente o offset do fuso;
  // duas iterações cobrem viradas de DST (SP não tem DST desde 2019, mas custa nada).
  let guess = wall
  for (let i = 0; i < 2; i++) guess = wall - (wallEpoch(new Date(guess)) - guess)
  return new Date(guess).toISOString()
}

/** ISO UTC → 'YYYY-MM-DDTHH:mm' na parede de São Paulo (pré-preenche o form do admin). */
export function utcIsoToSpWall(iso: string): string {
  const p = spParts(new Date(iso))
  return `${p['year']}-${p['month']}-${p['day']}T${p['hour']}:${p['minute']}`
}
