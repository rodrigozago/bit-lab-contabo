/**
 * Converte um retângulo (x, y, largura, altura) em SVG path data ("d").
 * Usado para transformar shapes do tldraw em áreas de bordado exportáveis.
 */
export function rectToSvgPath(x: number, y: number, w: number, h: number): string {
  const r = (n: number) => +n.toFixed(2);
  return `M ${r(x)} ${r(y)} L ${r(x + w)} ${r(y)} L ${r(x + w)} ${r(y + h)} L ${r(x)} ${r(y + h)} Z`;
}

/** Retângulo em page-px do tldraw. */
export interface RectBounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Inverso de `rectToSvgPath`: lê o retângulo (posição + tamanho, em page-px)
 * do `svgPath` persistido de uma parte. É o que permite recriar o shape no
 * MESMO lugar/tamanho ao reabrir o projeto (antes o load ignorava isso e
 * jogava tudo no centro do viewport a 100×100). `null` se o `d` não tiver os
 * 8 números de um retângulo (`M x y L … Z`) ou for degenerado.
 */
export function parseRectSvgPath(svgPath: string | undefined): RectBounds | null {
  if (!svgPath) return null;
  const nums = (svgPath.match(/-?\d+\.?\d*/g) ?? []).map(Number);
  if (nums.length < 8) return null;
  const xs = [nums[0]!, nums[2]!, nums[4]!, nums[6]!];
  const ys = [nums[1]!, nums[3]!, nums[5]!, nums[7]!];
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const w = maxX - minX, h = maxY - minY;
  if (!(w > 0) || !(h > 0)) return null;
  return { x: minX, y: minY, w, h };
}
