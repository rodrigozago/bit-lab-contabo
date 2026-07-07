import { config } from "../config.js";
import { getRedis } from "../redis.js";

// Janela fixa por minuto em Redis — contadores efêmeros só pra frear consumo;
// a contabilização durável pra planos futuros fica em usage_events (Postgres).

function minuteWindow(): number {
  return Math.floor(Date.now() / 60_000);
}

async function tryTake(keys: { key: string; limit: number }[]): Promise<boolean> {
  const redis = await getRedis();
  const counts: number[] = [];
  for (const { key } of keys) {
    const n = await redis.incr(key);
    if (n === 1) await redis.expire(key, 120);
    counts.push(n);
  }
  const over = keys.some(({ limit }, i) => (counts[i] ?? 0) > limit);
  if (over) {
    // devolve os incrementos pra não "queimar" a janela de quem esperou
    for (const { key } of keys) await redis.decr(key);
    return false;
  }
  return true;
}

function msUntilNextWindow(): number {
  return 60_000 - (Date.now() % 60_000) + 250;
}

/**
 * Reserva 1 reconhecimento (foto) pro producer — bloqueia até haver janela
 * (limite do producer E global). Usado no loop do scan: não falha, só desacelera.
 */
export async function waitForPhotoSlot(producerId: string): Promise<void> {
  for (;;) {
    const w = minuteWindow();
    const ok = await tryTake([
      { key: `rl:producer:${producerId}:${w}`, limit: config.rate.producerPerMin },
      { key: `rl:global:${w}`, limit: config.rate.globalPerMin },
    ]);
    if (ok) return;
    await new Promise((r) => setTimeout(r, msUntilNextWindow()));
  }
}

/** Enrollment é interativo — não bloqueia, retorna false pro endpoint responder 429. */
export async function tryEnrollSlot(): Promise<boolean> {
  const w = minuteWindow();
  return tryTake([{ key: `rl:enroll:${w}`, limit: config.rate.enrollPerMin }]);
}
