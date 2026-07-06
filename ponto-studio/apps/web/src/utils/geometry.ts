/**
 * Converte um retângulo (x, y, largura, altura) em SVG path data ("d").
 * Usado para transformar shapes do tldraw em áreas de bordado exportáveis.
 */
export function rectToSvgPath(x: number, y: number, w: number, h: number): string {
  const r = (n: number) => +n.toFixed(2);
  return `M ${r(x)} ${r(y)} L ${r(x + w)} ${r(y)} L ${r(x + w)} ${r(y + h)} L ${r(x)} ${r(y + h)} Z`;
}
