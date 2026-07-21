/**
 * Extração dos 2 trilhos (rails) de um cetim (Satin Column) a partir do
 * contorno de um polígono ARBITRÁRIO — usado quando o elemento tem
 * `svgContent` (geometria complexa vinda de importação de imagem), ao
 * contrário do caso trivial de retângulo (ver `satinColumnToSvgGroup` em
 * `svgConverter.ts`, que só usa o bbox pra formas simples desenhadas no editor).
 *
 * Algoritmo (ver docs/MOTOR-BORDADO-INKSTITCH.md, Fase 4):
 *  1. Acha o eixo principal do contorno via PCA 2D (autovetor da matriz de
 *     covariância) — a direção em que a forma é mais "comprida".
 *  2. Projeta todo vértice nesse eixo; os vértices de projeção MÍNIMA e
 *     MÁXIMA são as 2 "pontas" da coluna. Quando várias vértices EMPATAM
 *     bem perto do extremo (ponta RETA, ex.: um retângulo — 2 cantos na
 *     mesma extremidade), esse trecho empatado é colapsado num único ponto
 *     sintético (média do trecho) antes do split — sem isso, a ponta reta
 *     quebra o split em 1-lado-vs-3-lados (achado testando com um retângulo
 *     de 4 cantos: ver `collapseTiedEnds`).
 *  3. Divide o anel do polígono (já com as pontas colapsadas) nessas 2
 *     pontas em 2 cadeias (os 2 lados).
 *  4. Reamostra as 2 cadeias pro MESMO número de pontos, por comprimento de
 *     arco (não por índice — os 2 lados podem ter números de vértices
 *     originais diferentes) — o Ink/Stitch pareia ponto[i] de um trilho com
 *     ponto[i] do outro (satin "old-style", sem rungs explícitos).
 *
 * `null` quando a forma não é elegível pra cetim (pouco alongada, poucos
 * pontos, empate espalhado em mais de 1 trecho — sinal de forma irregular) —
 * quem chama cai no fallback pra tatami.
 */

export type Point = [number, number];

export interface RailPair {
  rail1: Point[];
  rail2: Point[];
}

/** Alongamento mínimo (comprimento/largura, ao longo do eixo principal) pra considerar a forma uma "coluna". */
export const MIN_SATIN_ELONGATION = 2;
/** Vértices a até esta fração do comprimento axial do extremo contam como "empatados" na mesma ponta. */
const TIE_TOLERANCE_RATIO = 0.02;
/** Espaçamento-alvo (mm) entre pontos reamostrados dos trilhos — não precisa ser fino, o zigue-zague em si é controlado por `zigzag_spacing_mm`. */
const RAIL_TARGET_SPACING_MM = 2;
const MIN_RAIL_POINTS = 3;
const MAX_RAIL_POINTS = 60;

export function extractSatinRails(rawPolygon: Point[]): RailPair | null {
  const polygon = dedupeConsecutive(rawPolygon);
  if (polygon.length < 4) return null;

  const { angle, centroid } = principalAxis(polygon);
  const dir: Point = [Math.cos(angle), Math.sin(angle)];
  const perp: Point = [-dir[1], dir[0]];

  const proj = polygon.map(([x, y]) => (x - centroid[0]) * dir[0] + (y - centroid[1]) * dir[1]);
  const perpProj = polygon.map(([x, y]) => (x - centroid[0]) * perp[0] + (y - centroid[1]) * perp[1]);

  const projMin = Math.min(...proj), projMax = Math.max(...proj);
  const length = projMax - projMin;
  const width = Math.max(...perpProj) - Math.min(...perpProj);
  if (!(width > 0) || !(length > 0) || length / width < MIN_SATIN_ELONGATION) return null;

  const collapsed = collapseTiedEnds(polygon, proj, projMin, projMax, length * TIE_TOLERANCE_RATIO);
  if (!collapsed) return null;
  const { ring, iMin, iMax } = collapsed;
  if (iMin === iMax || ring.length < 4) return null;

  const [chain1, chain2Raw] = splitRing(ring, iMin, iMax);
  if (chain1.length < 2 || chain2Raw.length < 2) return null;
  const chain2 = [...chain2Raw].reverse();

  const avgLen = (chainLength(chain1) + chainLength(chain2)) / 2;
  if (!(avgLen > 0)) return null;
  const n = Math.min(MAX_RAIL_POINTS, Math.max(MIN_RAIL_POINTS, Math.round(avgLen / RAIL_TARGET_SPACING_MM) + 1));

  return {
    rail1: resampleByArcLength(chain1, n),
    rail2: resampleByArcLength(chain2, n),
  };
}

/** Centro e ângulo (rad) do eixo principal via PCA 2D — autovetor de maior autovalor da matriz de covariância. */
function principalAxis(points: Point[]): { angle: number; centroid: Point } {
  let cx = 0, cy = 0;
  for (const [x, y] of points) { cx += x; cy += y; }
  cx /= points.length; cy /= points.length;

  let sxx = 0, sxy = 0, syy = 0;
  for (const [x, y] of points) {
    const dx = x - cx, dy = y - cy;
    sxx += dx * dx; sxy += dx * dy; syy += dy * dy;
  }
  const angle = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  return { angle, centroid: [cx, cy] };
}

/**
 * Colapsa, em cada extremidade (min/max de `proj`), o trecho CONTÍGUO de
 * vértices empatados (dentro de `tolerance`) num único ponto sintético
 * (média do trecho) — devolve o anel resultante + os índices, nesse novo
 * anel, dos 2 pontos-ponta. `null` se o empate estiver espalhado em mais de
 * 1 trecho em alguma ponta (forma irregular, não dá pra saber qual é a
 * ponta de verdade).
 */
function collapseTiedEnds(
  polygon: Point[], proj: number[], projMin: number, projMax: number, tolerance: number
): { ring: Point[]; iMin: number; iMax: number } | null {
  const isMinTied = proj.map((p) => p - projMin <= tolerance);
  const isMaxTied = proj.map((p) => projMax - p <= tolerance);
  const minRun = findSingleContiguousRun(isMinTied);
  const maxRun = findSingleContiguousRun(isMaxTied);
  if (!minRun || !maxRun) return null;

  const minSet = new Set(minRun);
  const maxSet = new Set(maxRun);
  const minPoint = averagePoints(minRun.map((i) => polygon[i]!));
  const maxPoint = averagePoints(maxRun.map((i) => polygon[i]!));

  const ring: Point[] = [];
  let iMin = -1, iMax = -1;
  for (let i = 0; i < polygon.length; i++) {
    if (minSet.has(i)) {
      if (iMin === -1) { iMin = ring.length; ring.push(minPoint); }
      continue;
    }
    if (maxSet.has(i)) {
      if (iMax === -1) { iMax = ring.length; ring.push(maxPoint); }
      continue;
    }
    ring.push(polygon[i]!);
  }
  return { ring, iMin, iMax };
}

/**
 * Acha um único trecho CONTÍGUO (ciclicamente) de índices onde `flag[i]` é
 * true — `null` se não houver nenhum, se cobrir o anel inteiro (degenerado),
 * ou se houver mais de 1 trecho separado (sinal de forma irregular).
 */
function findSingleContiguousRun(flag: boolean[]): number[] | null {
  const n = flag.length;
  if (!flag.some(Boolean) || flag.every(Boolean)) return null;

  const startOutside = flag.findIndex((f) => !f);
  const run: number[] = [];
  for (let k = 1; k <= n; k++) {
    const i = (startOutside + k) % n;
    if (i === startOutside) break;
    if (flag[i]) run.push(i);
    else if (run.length) break;
  }

  const runSet = new Set(run);
  for (let i = 0; i < n; i++) {
    if (flag[i] && !runSet.has(i)) return null;
  }
  return run.length ? run : null;
}

function averagePoints(points: Point[]): Point {
  let sx = 0, sy = 0;
  for (const [x, y] of points) { sx += x; sy += y; }
  return [sx / points.length, sy / points.length];
}

/** Divide um anel (polígono fechado, sem ponto de fechamento duplicado) em 2 cadeias nos índices dados. */
function splitRing<T>(ring: T[], iA: number, iB: number): [T[], T[]] {
  const lo = Math.min(iA, iB), hi = Math.max(iA, iB);
  const chain1 = ring.slice(lo, hi + 1);
  const chain2 = [...ring.slice(hi), ...ring.slice(0, lo + 1)];
  return [chain1, chain2];
}

function chainLength(chain: Point[]): number {
  let len = 0;
  for (let i = 1; i < chain.length; i++) {
    const [x0, y0] = chain[i - 1]!;
    const [x1, y1] = chain[i]!;
    len += Math.hypot(x1 - x0, y1 - y0);
  }
  return len;
}

/** Reamostra uma cadeia de pontos pra exatamente `n` pontos, uniformemente por comprimento de arco. */
function resampleByArcLength(chain: Point[], n: number): Point[] {
  if (chain.length < 2 || n < 2) return chain;
  const cum: number[] = [0];
  for (let i = 1; i < chain.length; i++) {
    const [x0, y0] = chain[i - 1]!;
    const [x1, y1] = chain[i]!;
    cum.push(cum[i - 1]! + Math.hypot(x1 - x0, y1 - y0));
  }
  const total = cum[cum.length - 1]!;
  if (total === 0) return [chain[0]!, chain[chain.length - 1]!];

  const out: Point[] = [];
  let seg = 0;
  for (let k = 0; k < n; k++) {
    const target = (k / (n - 1)) * total;
    while (seg < cum.length - 2 && cum[seg + 1]! < target) seg++;
    const segStart = cum[seg]!, segEnd = cum[seg + 1]!;
    const t = segEnd > segStart ? (target - segStart) / (segEnd - segStart) : 0;
    const [x0, y0] = chain[seg]!;
    const [x1, y1] = chain[seg + 1]!;
    out.push([x0 + (x1 - x0) * t, y0 + (y1 - y0) * t]);
  }
  return out;
}

/** Remove pontos consecutivos duplicados (curvas achatadas podem repetir o ponto final) e o fechamento duplicado do anel. */
function dedupeConsecutive(points: Point[]): Point[] {
  const out: Point[] = [];
  for (const p of points) {
    const prev = out[out.length - 1];
    if (!prev || Math.hypot(p[0] - prev[0], p[1] - prev[1]) > 1e-6) out.push(p);
  }
  if (out.length > 1) {
    const first = out[0]!, last = out[out.length - 1]!;
    if (Math.hypot(first[0] - last[0], first[1] - last[1]) < 1e-6) out.pop();
  }
  return out;
}
