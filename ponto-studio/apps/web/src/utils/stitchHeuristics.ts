import type { AnalyzeLayerMetrics, AnalyzeMetrics, StitchParams } from "@ponto-studio/shared";

/**
 * Heurística de sugestão de parâmetros de ponto por camada de cor — o público
 * do app NÃO sabe digitalizar bordado, então em vez de defaults fixos
 * (tatami/0.6/45° pra tudo) cada parte nasce com parâmetros derivados da
 * geometria real da camada (métricas da análise, ver AnalyzeLayerMetrics).
 *
 * Regras (motor = Ink/Stitch real; `contour`/`meander` não suportam `angle`
 * direcional — confirmado rodando o binário, ver docs/MOTOR-BORDADO-INKSTITCH.md
 * Fase 1 — por isso a sugestão pra colunas alongadas usa TATAMI com o ângulo
 * apontado na direção certa, não mais um "cetim" que nunca existiu de
 * verdade — cetim real de 2 trilhos é Fase 3):
 *  - traço mais fino que ~1.2mm não sustenta preenchimento → ponto corrido;
 *  - coluna fina (1.2–8mm) e alongada → tatami com ângulo PERPENDICULAR ao
 *    eixo principal (linhas atravessam a coluna, parecido com o efeito de um
 *    cetim), underlay quando passa de 3mm;
 *  - forma arredondada (pouco alongada) de área pequena/média → circular
 *    (espiral a partir do centro fica bem em formas tipo bolinha/pétala);
 *  - resto (áreas grandes/irregulares) → tatami; underlay quando a área é
 *    grande; o ângulo alterna 45°/135° entre camadas pra distorção de tração
 *    não acumular toda na mesma direção.
 *  - `contour`/`meander` ficam de fora da sugestão automática por ora — sem
 *    um sinal geométrico claro de "quando usar", o usuário escolhe manual.
 */

/** Traço mais fino que isso (mm) vira ponto corrido. */
export const MIN_RUNNING_WIDTH_MM = 1.2;
/** Coluna mais larga que isso (mm) não conta mais como "coluna alongada". */
export const MAX_COLUMN_WIDTH_MM = 8;
/** Alongamento (razão dos eixos principais) mínimo pra tratar como coluna. */
export const MIN_COLUMN_ELONGATION = 2.5;
/** Coluna mais larga que isso (mm) pede underlay. */
export const COLUMN_UNDERLAY_MIN_WIDTH_MM = 3;
/** Alongamento MÁXIMO pra tratar a forma como "arredondada" (candidata a circular). */
export const MAX_ROUND_ELONGATION = 1.4;
/** Área (mm²) máxima pra sugerir circular (formas grandes ficam de tatami). */
export const MAX_ROUND_AREA_MM2 = 400;
/** Área (mm²) a partir da qual o tatami pede underlay. */
export const TATAMI_UNDERLAY_MIN_AREA_MM2 = 100;

export const DEFAULT_STITCH: StitchParams = { type: "tatami", density: 0.6, angle: 45 };

/**
 * Sugere StitchParams pra uma camada. `pxPerMm` converte as métricas (em px da
 * imagem analisada) pra mm reais no bastidor; `layerIndex` alterna o ângulo do
 * tatami entre camadas. Sem métricas → chame com `undefined` e receba o default.
 */
export function suggestStitchParams(
  metrics: AnalyzeLayerMetrics | undefined,
  imageMetrics: Pick<AnalyzeMetrics, "imageWidth" | "imageHeight"> | undefined,
  pxPerMm: number,
  layerIndex: number
): StitchParams {
  if (!metrics || !imageMetrics || !(pxPerMm > 0)) return { ...DEFAULT_STITCH };

  const widthMm = metrics.meanWidthPx / pxPerMm;
  const imageAreaMm2 = (imageMetrics.imageWidth * imageMetrics.imageHeight) / (pxPerMm * pxPerMm);
  const areaMm2 = (metrics.areaPct / 100) * imageAreaMm2;

  if (widthMm < MIN_RUNNING_WIDTH_MM) {
    return { type: "running", density: 0.5, angle: 0 };
  }

  if (widthMm < MAX_COLUMN_WIDTH_MM && metrics.elongation > MIN_COLUMN_ELONGATION) {
    return {
      type: "tatami",
      density: 0.7,
      // linhas atravessam a coluna: perpendicular ao eixo principal
      angle: clampAngle((metrics.principalAngleDeg + 90) % 180),
      ...(widthMm > COLUMN_UNDERLAY_MIN_WIDTH_MM ? { underlay: true } : {}),
    };
  }

  if (metrics.elongation < MAX_ROUND_ELONGATION && areaMm2 > 0 && areaMm2 < MAX_ROUND_AREA_MM2) {
    return {
      type: "circular",
      density: 0.6,
      ...(areaMm2 > TATAMI_UNDERLAY_MIN_AREA_MM2 ? { underlay: true } : {}),
    };
  }

  return {
    type: "tatami",
    density: 0.7,
    angle: layerIndex % 2 === 0 ? 45 : 135,
    ...(areaMm2 > TATAMI_UNDERLAY_MIN_AREA_MM2 ? { underlay: true } : {}),
  };
}

/** Casa a camada de cor (hex) com as métricas — exato primeiro, senão a mais
 * próxima em RGB (as fusões de cor da análise podem renomear levemente). */
export function findLayerMetrics(
  metrics: AnalyzeMetrics | undefined,
  colorHex: string
): AnalyzeLayerMetrics | undefined {
  if (!metrics?.layers.length) return undefined;
  const target = colorHex.toLowerCase();
  const exact = metrics.layers.find((l) => l.color.toLowerCase() === target);
  if (exact) return exact;

  const rgb = hexToRgb(target);
  if (!rgb) return undefined;
  let best: AnalyzeLayerMetrics | undefined;
  let bestDist = Infinity;
  for (const layer of metrics.layers) {
    const lrgb = hexToRgb(layer.color);
    if (!lrgb) continue;
    const d = (rgb[0] - lrgb[0]) ** 2 + (rgb[1] - lrgb[1]) ** 2 + (rgb[2] - lrgb[2]) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = layer;
    }
  }
  return best;
}

/**
 * Sugere o nº de cores da análise a partir da própria imagem, no cliente:
 * reduz pra ≤128px num canvas, conta buckets de cor de 5 bits/canal (mesmo
 * espírito do is_flat_image do worker) e devolve quantos buckets cobrem 90%
 * dos pixels — clampado a 2..6. A cor mais frequente é tratada como fundo
 * (excluída da contagem), já que a análise remove o fundo por padrão.
 */
export function suggestColorsFromImage(img: HTMLImageElement): number | null {
  const MAX_SIDE = 128;
  const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, w, h);

  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(0, 0, w, h).data;
  } catch {
    return null; // canvas tainted (não deve acontecer com data URLs)
  }

  const counts = new Map<number, number>();
  let total = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3]! < 128) continue; // ignora pixels transparentes
    const key = ((data[i]! >> 3) << 10) | ((data[i + 1]! >> 3) << 5) | (data[i + 2]! >> 3);
    counts.set(key, (counts.get(key) ?? 0) + 1);
    total++;
  }
  if (total === 0) return null;

  const sorted = [...counts.values()].sort((a, b) => b - a);
  // a cor dominante é o fundo (a análise o remove); conta as demais até 90%
  const foreground = total - (sorted[0] ?? 0);
  if (foreground <= 0) return 2;
  let covered = 0;
  let n = 0;
  for (const c of sorted.slice(1)) {
    covered += c;
    n++;
    if (covered >= foreground * 0.9) break;
  }
  return Math.min(6, Math.max(2, n));
}

function clampAngle(angle: number): number {
  const a = Math.round(angle) % 180;
  return a < 0 ? a + 180 : a;
}

function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1]!, 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}
