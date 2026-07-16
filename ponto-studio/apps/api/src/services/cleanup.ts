import { readdir, stat, unlink } from "fs/promises";
import { join } from "path";
import type { FastifyBaseLogger } from "fastify";

const HOUR_MS = 60 * 60 * 1000;
const SWEEP_INTERVAL_MS = HOUR_MS;

function ttlHours(envVar: string, defaultHours: number): number {
  const raw = process.env[envVar];
  const parsed = raw !== undefined ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : defaultHours;
}

/** Remove arquivos de `dir` com mtime mais velho que `maxAgeMs`. Retorna quantos apagou. */
export async function sweepDir(dir: string, maxAgeMs: number): Promise<number> {
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return 0; // diretório pode não existir ainda (ex.: uploads/ antes do primeiro upload)
  }

  const cutoff = Date.now() - maxAgeMs;
  let removed = 0;
  for (const name of entries) {
    const path = join(dir, name);
    try {
      const info = await stat(path);
      if (info.isFile() && info.mtimeMs < cutoff) {
        await unlink(path);
        removed++;
      }
    } catch {
      // arquivo pode ter sido removido por outra sweep concorrente — ignora
    }
  }
  return removed;
}

/**
 * Limpeza periódica de exports/ e uploads/ (INF-4) — hoje nada apagava esses
 * arquivos e os named volumes cresciam pra sempre. Roda no boot e a cada 1h.
 * TTLs configuráveis via env, default 24h.
 */
export function startCleanup(dirs: { exportsDir: string; uploadsDir: string }, log: FastifyBaseLogger): void {
  const exportsTtlMs = ttlHours("EXPORTS_TTL_HOURS", 24) * HOUR_MS;
  const uploadsTtlMs = ttlHours("UPLOADS_TTL_HOURS", 24) * HOUR_MS;

  async function sweep() {
    const [exportsRemoved, uploadsRemoved] = await Promise.all([
      sweepDir(dirs.exportsDir, exportsTtlMs),
      sweepDir(dirs.uploadsDir, uploadsTtlMs),
    ]);
    if (exportsRemoved > 0 || uploadsRemoved > 0) {
      log.info({ exportsRemoved, uploadsRemoved }, "cleanup: arquivos antigos removidos");
    }
  }

  void sweep();
  setInterval(() => void sweep(), SWEEP_INTERVAL_MS);
}
