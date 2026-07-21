/**
 * Reescala coordenadas de paths SVG do espaço de origem (viewBox do SVG
 * gerado pela IA) para o espaço de destino (canvas do projeto, em mm).
 *
 * Necessário porque o worker de bordado (pyembroidery/svgpathtools) lê os
 * números crus do atributo "d" como milímetros — ele NÃO aplica viewBox de
 * <svg> aninhado nem transform="scale()" em <g> (confirmado experimentalmente).
 * Sem essa normalização, um SVG com viewBox diferente do canvas do projeto
 * gera um bordado maior/menor que o bastidor, mesmo que o preview no
 * navegador pareça correto (o <img> apenas estica a imagem visualmente).
 */

export interface Dimensions {
  width: number;
  height: number;
}

export interface FitTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
}

/** Extrai width/height do viewBox (ou, na ausência, dos atributos width/height) da tag <svg> raiz. */
export function parseViewBoxDimensions(svg: string): Dimensions | null {
  const svgTagMatch = svg.match(/<svg\b[^>]*>/i);
  if (!svgTagMatch) return null;
  const tag = svgTagMatch[0];

  const viewBoxMatch = /viewBox=["']\s*([-\d.eE]+)\s+([-\d.eE]+)\s+([-\d.eE]+)\s+([-\d.eE]+)\s*["']/i.exec(tag);
  if (viewBoxMatch) {
    const width = parseFloat(viewBoxMatch[3]!);
    const height = parseFloat(viewBoxMatch[4]!);
    if (width > 0 && height > 0) return { width, height };
  }

  const widthMatch = /\bwidth=["']([\d.]+)/i.exec(tag);
  const heightMatch = /\bheight=["']([\d.]+)/i.exec(tag);
  if (widthMatch && heightMatch) {
    const width = parseFloat(widthMatch[1]!);
    const height = parseFloat(heightMatch[1]!);
    if (width > 0 && height > 0) return { width, height };
  }

  return null;
}

/**
 * Calcula escala uniforme "contain" (preserva proporção, sem distorcer o
 * desenho) e o deslocamento para centralizar o resultado no destino.
 */
export function computeContainTransform(source: Dimensions, target: Dimensions): FitTransform {
  const scale = Math.min(target.width / source.width, target.height / source.height);
  const offsetX = (target.width - source.width * scale) / 2;
  const offsetY = (target.height - source.height * scale) / 2;
  return { scale, offsetX, offsetY };
}

// Papel de cada argumento posicional por comando de path SVG:
//  "x"/"y"    → coordenada: escala + desloca (apenas se comando absoluto)
//  "r"        → raio/distância: só escala, nunca desloca
//  "none"     → ângulo/flag: não é tocado
const ARG_ROLES: Record<string, Array<"x" | "y" | "r" | "none">> = {
  M: ["x", "y"],
  L: ["x", "y"],
  T: ["x", "y"],
  H: ["x"],
  V: ["y"],
  C: ["x", "y", "x", "y", "x", "y"],
  S: ["x", "y", "x", "y"],
  Q: ["x", "y", "x", "y"],
  A: ["r", "r", "none", "none", "none", "x", "y"],
};

function roundNum(n: number): string {
  return Number(n.toFixed(3)).toString();
}

/**
 * Rotaciona todas as coordenadas de um atributo "d" de path SVG em torno de
 * (cx, cy). Ao contrário de `scalePathData` (que escala x e y de forma
 * independente), rotação MISTURA x e y — não dá pra tratar cada eixo
 * separadamente, então esta função reprocessa o path token a token,
 * convertendo tudo pra coordenadas ABSOLUTAS (mais simples de raciocinar
 * que preservar comandos relativos através de uma rotação):
 *   - H/V (só têm 1 eixo) viram L (a rotação deixa de ser paralela ao eixo);
 *   - M com múltiplos pares de coordenada: pares extras são LINETO implícito
 *     (regra do spec SVG) — tratados como L, não como M adicional;
 *   - A (arco): o ponto final rotaciona normalmente; `x-axis-rotation` do
 *     arco precisa somar o ângulo de rotação (rx/ry e os flags não mudam —
 *     rotação pura preserva os raios).
 * Usada pra embutir a rotação de uma parte (definida no editor/tldraw) nas
 * coordenadas antes de exportar — o Ink/Stitch ignora atributos/transform
 * customizados, então a rotação PRECISA estar no "d" em si.
 */
export function rotatePathData(d: string, angleDeg: number, cx: number, cy: number): string {
  const normalizedAngle = ((angleDeg % 360) + 360) % 360;
  if (normalizedAngle === 0) return d;

  const rad = (normalizedAngle * Math.PI) / 180;
  const cos = Math.cos(rad), sin = Math.sin(rad);
  const rotatePoint = (x: number, y: number): [number, number] => {
    const dx = x - cx, dy = y - cy;
    return [cx + dx * cos - dy * sin, cy + dx * sin + dy * cos];
  };

  const tokens = d.match(/[MLHVCSQTAZmlhvcsqtaz]|-?\d*\.?\d+(?:[eE][+-]?\d+)?/g) ?? [];
  const out: string[] = [];
  let i = 0;
  let currentCmd = "";   // letra crua do "d" original (maiúscula=absoluto, minúscula=relativo)
  let effectiveCmd = ""; // letra usada NESTE grupo (M vira L nos pares extras implícitos)
  let curX = 0, curY = 0;
  let startX = 0, startY = 0; // início do subpath atual, pra Z

  while (i < tokens.length) {
    const tok = tokens[i]!;
    const isNewCommand = /^[MLHVCSQTAZ]$/i.test(tok);
    if (isNewCommand) {
      currentCmd = tok;
      effectiveCmd = tok;
      i++;
      if (currentCmd.toUpperCase() === "Z") {
        out.push("Z");
        curX = startX;
        curY = startY;
        continue;
      }
    }

    const upper = effectiveCmd.toUpperCase();
    const isRelative = currentCmd !== currentCmd.toUpperCase();
    const wasFreshM = isNewCommand && upper === "M";

    if (upper === "H") {
      const raw = parseFloat(tokens[i]!); i++;
      const absX = isRelative ? curX + raw : raw;
      const [rx, ry] = rotatePoint(absX, curY);
      out.push("L", roundNum(rx), roundNum(ry));
      curX = absX;
    } else if (upper === "V") {
      const raw = parseFloat(tokens[i]!); i++;
      const absY = isRelative ? curY + raw : raw;
      const [rx, ry] = rotatePoint(curX, absY);
      out.push("L", roundNum(rx), roundNum(ry));
      curY = absY;
    } else if (upper === "A") {
      const rx = parseFloat(tokens[i]!); i++;
      const ry = parseFloat(tokens[i]!); i++;
      const xAxisRotation = parseFloat(tokens[i]!); i++;
      const largeArc = tokens[i]!; i++;
      const sweep = tokens[i]!; i++;
      const rawX = parseFloat(tokens[i]!); i++;
      const rawY = parseFloat(tokens[i]!); i++;
      const absX = isRelative ? curX + rawX : rawX;
      const absY = isRelative ? curY + rawY : rawY;
      const [ex, ey] = rotatePoint(absX, absY);
      const newXAxisRotation = (xAxisRotation + normalizedAngle) % 360;
      out.push(
        "A", roundNum(rx), roundNum(ry), roundNum(newXAxisRotation),
        largeArc, sweep, roundNum(ex), roundNum(ey)
      );
      curX = absX;
      curY = absY;
    } else {
      // M, L, T: 1 ponto | C: 3 pontos | S, Q: 2 pontos — todos "x y" puros
      const pointCount = upper === "C" ? 3 : upper === "S" || upper === "Q" ? 2 : 1;
      const rotated: Array<[number, number]> = [];
      let lastAbsX = curX, lastAbsY = curY;
      for (let p = 0; p < pointCount; p++) {
        const rawX = parseFloat(tokens[i]!); i++;
        const rawY = parseFloat(tokens[i]!); i++;
        // relativo é sempre em relação ao ponto de ANTES do comando inteiro,
        // não ao ponto intermediário dentro do mesmo comando (regra do spec)
        const absX = isRelative ? curX + rawX : rawX;
        const absY = isRelative ? curY + rawY : rawY;
        rotated.push(rotatePoint(absX, absY));
        lastAbsX = absX;
        lastAbsY = absY;
      }
      out.push(upper);
      for (const [rx, ry] of rotated) out.push(roundNum(rx), roundNum(ry));
      curX = lastAbsX;
      curY = lastAbsY;
    }

    if (wasFreshM) {
      startX = curX;
      startY = curY;
      // pares extras depois do primeiro par de um M são LINETO implícito
      effectiveCmd = isRelative ? "l" : "L";
    }
  }

  return out.join(" ");
}

const DEFAULT_CURVE_SEGMENTS = 16;

function sampleCubicBezier(
  x0: number, y0: number, c1: [number, number], c2: [number, number], end: [number, number],
  segments: number, push: (x: number, y: number) => void
): void {
  for (let s = 1; s <= segments; s++) {
    const t = s / segments;
    const mt = 1 - t;
    const x = mt * mt * mt * x0 + 3 * mt * mt * t * c1[0] + 3 * mt * t * t * c2[0] + t * t * t * end[0];
    const y = mt * mt * mt * y0 + 3 * mt * mt * t * c1[1] + 3 * mt * t * t * c2[1] + t * t * t * end[1];
    push(x, y);
  }
}

function sampleQuadBezier(
  x0: number, y0: number, ctrl: [number, number], end: [number, number],
  segments: number, push: (x: number, y: number) => void
): void {
  for (let s = 1; s <= segments; s++) {
    const t = s / segments;
    const mt = 1 - t;
    const x = mt * mt * x0 + 2 * mt * t * ctrl[0] + t * t * end[0];
    const y = mt * mt * y0 + 2 * mt * t * ctrl[1] + t * t * end[1];
    push(x, y);
  }
}

/** Ângulo entre 2 vetores, com sinal (produto vetorial define o sinal) — usado pra parametrização de arco (SVG spec Appendix F.6.5). */
function signedAngleBetween(ux: number, uy: number, vx: number, vy: number): number {
  const sign = ux * vy - uy * vx < 0 ? -1 : 1;
  const dot = Math.max(-1, Math.min(1, (ux * vx + uy * vy) / (Math.hypot(ux, uy) * Math.hypot(vx, vy))));
  return sign * Math.acos(dot);
}

/** Amostra um arco elíptico SVG (comando "A") — parametrização de extremidade → centro, conforme SVG spec Appendix F.6.5. */
function sampleArc(
  x0: number, y0: number, rxIn: number, ryIn: number, xAxisRotationDeg: number,
  largeArc: boolean, sweep: boolean, ex: number, ey: number,
  segments: number, push: (x: number, y: number) => void
): void {
  if (rxIn === 0 || ryIn === 0 || (x0 === ex && y0 === ey)) {
    push(ex, ey);
    return;
  }
  let rx = Math.abs(rxIn), ry = Math.abs(ryIn);
  const phi = (xAxisRotationDeg * Math.PI) / 180;
  const cosPhi = Math.cos(phi), sinPhi = Math.sin(phi);

  const dx2 = (x0 - ex) / 2, dy2 = (y0 - ey) / 2;
  const x1p = cosPhi * dx2 + sinPhi * dy2;
  const y1p = -sinPhi * dx2 + cosPhi * dy2;

  const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lambda > 1) {
    const scale = Math.sqrt(lambda);
    rx *= scale; ry *= scale;
  }

  const sign = largeArc === sweep ? -1 : 1;
  const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
  const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
  const coef = sign * Math.sqrt(Math.max(0, num / den));
  const cxp = (coef * (rx * y1p)) / ry;
  const cyp = (coef * -(ry * x1p)) / rx;

  const cx = cosPhi * cxp - sinPhi * cyp + (x0 + ex) / 2;
  const cy = sinPhi * cxp + cosPhi * cyp + (y0 + ey) / 2;

  const theta1 = signedAngleBetween(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let dTheta = signedAngleBetween((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!sweep && dTheta > 0) dTheta -= 2 * Math.PI;
  if (sweep && dTheta < 0) dTheta += 2 * Math.PI;

  for (let s = 1; s <= segments; s++) {
    const theta = theta1 + (dTheta * s) / segments;
    const x = cx + rx * Math.cos(theta) * cosPhi - ry * Math.sin(theta) * sinPhi;
    const y = cy + rx * Math.cos(theta) * sinPhi + ry * Math.sin(theta) * cosPhi;
    push(x, y);
  }
}

/**
 * Achata um atributo "d" de path SVG numa lista de subcaminhos, cada um uma
 * polilinha de pontos `[x, y]` — curvas (C/S/Q/T/A) são subdivididas com
 * resolução FIXA (`segmentsPerCurve`), não tolerância adaptativa: pra
 * extração de trilhos de cetim a costura já opera na faixa de 0.2–1mm, então
 * não vale a pena uma malha mais fina que isso. Cada "M" inicia um novo
 * subcaminho; "Z" fecha o atual (soma o ponto inicial de volta) sem abrir um
 * novo. Mesma convenção de comandos absolutos/relativos de `rotatePathData`
 * (H/V só têm 1 eixo; pares extras após o primeiro M são LINETO implícito;
 * S/T refletem o ponto de controle da curva anterior — regra do spec SVG).
 */
export function flattenPathData(d: string, segmentsPerCurve = DEFAULT_CURVE_SEGMENTS): Array<Array<[number, number]>> {
  const tokens = d.match(/[MLHVCSQTAZ]|-?\d*\.?\d+(?:[eE][+-]?\d+)?/gi) ?? [];
  const subpaths: Array<Array<[number, number]>> = [];
  let current: Array<[number, number]> = [];
  let i = 0;
  let currentCmd = "";
  let effectiveCmd = "";
  let curX = 0, curY = 0;
  let startX = 0, startY = 0;
  let prevCubicCtrl2: [number, number] | null = null;
  let prevQuadCtrl: [number, number] | null = null;

  const push = (x: number, y: number) => current.push([x, y]);
  const readNum = () => { const n = parseFloat(tokens[i]!); i++; return n; };

  while (i < tokens.length) {
    const tok = tokens[i]!;
    const isNewCommand = /^[MLHVCSQTAZ]$/i.test(tok);
    if (isNewCommand) {
      currentCmd = tok;
      effectiveCmd = tok;
      i++;
      const upperNew = currentCmd.toUpperCase();
      if (upperNew !== "C" && upperNew !== "S") prevCubicCtrl2 = null;
      if (upperNew !== "Q" && upperNew !== "T") prevQuadCtrl = null;
      if (upperNew === "Z") {
        if (current.length) push(startX, startY);
        curX = startX; curY = startY;
        if (current.length) { subpaths.push(current); current = []; }
        continue;
      }
      if (upperNew === "M" && current.length) {
        subpaths.push(current);
        current = [];
      }
    }

    const upper = effectiveCmd.toUpperCase();
    const isRelative = currentCmd !== currentCmd.toUpperCase();
    const wasFreshM = isNewCommand && upper === "M";
    const absPoint = (rawX: number, rawY: number): [number, number] =>
      isRelative ? [curX + rawX, curY + rawY] : [rawX, rawY];

    if (upper === "M" || upper === "L" || upper === "T") {
      const [ax, ay] = absPoint(readNum(), readNum());
      if (upper === "T") {
        const ctrl: [number, number] = prevQuadCtrl ? [2 * curX - prevQuadCtrl[0], 2 * curY - prevQuadCtrl[1]] : [curX, curY];
        sampleQuadBezier(curX, curY, ctrl, [ax, ay], segmentsPerCurve, push);
        prevQuadCtrl = ctrl;
      } else {
        push(ax, ay);
      }
      curX = ax; curY = ay;
    } else if (upper === "H") {
      const ax = isRelative ? curX + readNum() : readNum();
      push(ax, curY); curX = ax;
    } else if (upper === "V") {
      const ay = isRelative ? curY + readNum() : readNum();
      push(curX, ay); curY = ay;
    } else if (upper === "C") {
      const c1 = absPoint(readNum(), readNum());
      const c2 = absPoint(readNum(), readNum());
      const end = absPoint(readNum(), readNum());
      sampleCubicBezier(curX, curY, c1, c2, end, segmentsPerCurve, push);
      prevCubicCtrl2 = c2;
      curX = end[0]; curY = end[1];
    } else if (upper === "S") {
      const c2 = absPoint(readNum(), readNum());
      const end = absPoint(readNum(), readNum());
      const c1: [number, number] = prevCubicCtrl2 ? [2 * curX - prevCubicCtrl2[0], 2 * curY - prevCubicCtrl2[1]] : [curX, curY];
      sampleCubicBezier(curX, curY, c1, c2, end, segmentsPerCurve, push);
      prevCubicCtrl2 = c2;
      curX = end[0]; curY = end[1];
    } else if (upper === "Q") {
      const ctrl = absPoint(readNum(), readNum());
      const end = absPoint(readNum(), readNum());
      sampleQuadBezier(curX, curY, ctrl, end, segmentsPerCurve, push);
      prevQuadCtrl = ctrl;
      curX = end[0]; curY = end[1];
    } else if (upper === "A") {
      const rx = readNum(), ry = readNum(), xRot = readNum();
      const largeArc = tokens[i]! === "1"; i++;
      const sweep = tokens[i]! === "1"; i++;
      const end = absPoint(readNum(), readNum());
      sampleArc(curX, curY, rx, ry, xRot, largeArc, sweep, end[0], end[1], segmentsPerCurve, push);
      curX = end[0]; curY = end[1];
    }

    if (wasFreshM) {
      startX = curX; startY = curY;
      effectiveCmd = isRelative ? "l" : "L";
    }
  }

  if (current.length) subpaths.push(current);
  return subpaths;
}

/** Reescala todas as coordenadas de um atributo "d" de path SVG. */
export function scalePathData(d: string, scale: number, offsetX: number, offsetY: number): string {
  const tokens = d.match(/[MLHVCSQTAZ]|-?\d*\.?\d+(?:[eE][+-]?\d+)?/gi) ?? [];
  const out: string[] = [];
  let currentCmd = "";
  let i = 0;

  while (i < tokens.length) {
    const tok = tokens[i]!;
    if (/^[MLHVCSQTAZ]$/i.test(tok)) {
      currentCmd = tok;
      out.push(tok);
      i++;
      continue;
    }

    const upper = currentCmd.toUpperCase();
    const roles = ARG_ROLES[upper] ?? [];
    const isAbsolute = currentCmd === upper;
    const arity = roles.length;
    if (arity === 0) {
      // Comando desconhecido ou sem argumentos numéricos — não deveria ocorrer
      i++;
      continue;
    }

    const group: string[] = [];
    for (let k = 0; k < arity && i < tokens.length; k++, i++) {
      const role = roles[k]!;
      const num = parseFloat(tokens[i]!);
      let scaled = num;
      if (role === "x") scaled = num * scale + (isAbsolute ? offsetX : 0);
      else if (role === "y") scaled = num * scale + (isAbsolute ? offsetY : 0);
      else if (role === "r") scaled = num * scale;
      group.push(roundNum(scaled));
    }
    out.push(group.join(" "));
  }

  return out.join(" ");
}
