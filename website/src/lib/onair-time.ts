import "server-only";
import type { ISbStoryData } from "@storyblok/react/rsc";
import type { OnAirSlotStoryContent, OnAirSlotView } from "./types";

// Regra do fuso: o campo Date/Time do Storyblok guarda a hora de parede que o
// editor digitou, sem fuso embutido na string — mesma natureza do que o form
// admin do on-air original capturava. Tratamos essa string como horário de
// São Paulo e convertemos pra um instante UTC real aqui, na leitura.
// Nunca `new Date('YYYY-MM-DDTHH:mm')` direto: parseia no fuso da máquina
// rodando o processo, não no de São Paulo.
const TZ = "America/Sao_Paulo";

const partsFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

function spParts(utc: Date): Record<string, string> {
  const out: Record<string, string> = {};
  for (const { type, value } of partsFmt.formatToParts(utc)) out[type] = value;
  if (out["hour"] === "24") out["hour"] = "00";
  return out;
}

/** Epoch "fake" tratando a parede SP como se fosse UTC — serve pra medir o offset. */
function wallEpoch(utc: Date): number {
  const p = spParts(utc);
  return Date.UTC(
    Number(p["year"]),
    Number(p["month"]) - 1,
    Number(p["day"]),
    Number(p["hour"]),
    Number(p["minute"]),
    Number(p["second"]),
  );
}

// Aceita "YYYY-MM-DDTHH:mm" (formato do <input datetime-local> do admin
// original) e "YYYY-MM-DD HH:mm:ss" (formato mais provável do campo Date/Time
// do Storyblok — espaço em vez de T, segundos opcionais). Ainda não confirmado
// contra uma story real; se o Storyblok devolver outra coisa, ajustar aqui.
const WALL_RE = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/;

/** 'YYYY-MM-DD[T ]HH:mm[:ss]' (parede em São Paulo) → ISO UTC. */
export function spWallToUtcIso(local: string): string | null {
  const m = WALL_RE.exec(local.trim());
  if (!m) return null;
  const wall = Date.UTC(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
    Number(m[4]),
    Number(m[5]),
    m[6] ? Number(m[6]) : 0,
  );
  // Chute inicial: UTC == parede. O erro do chute é exatamente o offset do
  // fuso; duas iterações cobrem viradas de DST (SP não tem desde 2019).
  let guess = wall;
  for (let i = 0; i < 2; i++) guess = wall - (wallEpoch(new Date(guess)) - guess);
  return new Date(guess).toISOString();
}

function toInstagramUrl(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://instagram.com/${raw.replace(/^@/, "")}`;
}

/** Converte uma story `on_air_slot` crua pra uma view serializável. Retorna
 * null (com aviso no log) se faltar algo essencial ou a data não parsear —
 * um registro malformado no CMS derruba só aquele slot, não a página. */
export function toOnAirSlotView(
  story: ISbStoryData<OnAirSlotStoryContent>,
): OnAirSlotView | null {
  const { artist, genre, photo, instagram, starts_at, ends_at } = story.content;

  if (!artist || !starts_at || !ends_at) {
    console.warn(`[on-air] story "${story.full_slug}" sem artist/starts_at/ends_at, ignorando`);
    return null;
  }

  const startsAtIso = spWallToUtcIso(starts_at);
  const endsAtIso = spWallToUtcIso(ends_at);
  if (!startsAtIso || !endsAtIso) {
    console.warn(
      `[on-air] story "${story.full_slug}" com starts_at/ends_at em formato inesperado: "${starts_at}" / "${ends_at}"`,
    );
    return null;
  }

  return {
    uid: story.uuid,
    artist,
    genre,
    photoUrl: photo?.filename,
    photoAlt: photo?.alt || artist,
    instagramRaw: instagram,
    instagramUrl: toInstagramUrl(instagram),
    startsAtIso,
    endsAtIso,
  };
}
