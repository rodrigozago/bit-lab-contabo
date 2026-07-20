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
