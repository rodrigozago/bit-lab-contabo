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
