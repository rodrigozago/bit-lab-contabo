import type { Editor as TldrawEditor, TLShape } from "@tldraw/tldraw";

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
 * Lê o bounding box (posição + tamanho, em page-px) do `svgPath` persistido
 * de uma parte — de QUALQUER polígono (`M x y L x y L x y ... Z`), não só
 * retângulos: min/max sobre TODOS os pares de coordenadas do `d`, não só os
 * 4 primeiros. Retângulo continua funcionando igual (caso particular de N=4
 * pontos). É o que permite recriar o shape no MESMO lugar/tamanho ao reabrir
 * o projeto (antes o load ignorava isso e jogava tudo no centro do viewport
 * a 100×100). `null` se o `d` não tiver pelo menos 2 pontos (4 números) ou
 * for degenerado (largura ou altura zero).
 */
export function parseSvgPathBounds(svgPath: string | undefined): RectBounds | null {
  if (!svgPath) return null;
  const nums = (svgPath.match(/-?\d+\.?\d*/g) ?? []).map(Number);
  if (nums.length < 4) return null;
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i + 1 < nums.length; i += 2) {
    xs.push(nums[i]!);
    ys.push(nums[i + 1]!);
  }
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const w = maxX - minX, h = maxY - minY;
  if (!(w > 0) || !(h > 0)) return null;
  return { x: minX, y: minY, w, h };
}

/**
 * Geometria REAL de um shape do tldraw (elipse, traço livre/"draw", ou
 * qualquer coisa além do atalho retangular) como SVG path — usa a geometria
 * já poligonalizada do próprio tldraw (`getShapeGeometry().toSimpleSvgPath()`,
 * sem arcos/Bezier: elipse e traço livre já vêm como polilinha), reposicionada
 * pra que o CENTRO do polígono caia em `center` (page-px). Mesma convenção do
 * atalho retangular já usado em Editor.tsx: `svgPath` guarda a forma NÃO
 * rotacionada, centrada no centro de rotação do shape (= centro da AABB
 * rotacionada em page-space); a rotação em si fica em `el.rotation`, aplicada
 * à parte na exportação. `null` se a geometria não tiver área (shape
 * degenerado/vazio) ou não tiver vértices.
 *
 * Traços livres abertos (`draw` sem fechar) viram um path SEM "Z" — como o
 * ponto padrão de uma parte nova é "tatami" (preenchimento), isso funciona
 * porque preenchimento de path SVG trata subcaminhos abertos como
 * implicitamente fechados (mesma semântica já usada no resto do pipeline
 * de bordado); só afetaria pontos de contorno/linha se o usuário trocasse
 * o tipo depois, que aí sim seguem o traço em aberto — comportamento
 * aceitável, não uma forma fechada forçada artificialmente.
 */
export function shapeGeometryToSvgPath(
  editor: TldrawEditor,
  shape: TLShape,
  center: { x: number; y: number }
): string | null {
  const geometry = editor.getShapeGeometry(shape);
  const bounds = geometry.bounds;
  if (!(bounds.w > 0) || !(bounds.h > 0)) return null;

  const dx = center.x - (bounds.x + bounds.w / 2);
  const dy = center.y - (bounds.y + bounds.h / 2);

  const local = geometry.toSimpleSvgPath();
  const tokens = local.match(/[MLZ]|-?\d*\.?\d+(?:[eE][+-]?\d+)?/gi) ?? [];
  const r = (n: number) => +n.toFixed(2);
  const out: string[] = [];
  let i = 0;
  while (i < tokens.length) {
    const tok = tokens[i]!;
    if (/^[MLZ]$/i.test(tok)) {
      out.push(tok.toUpperCase());
      i++;
      continue;
    }
    const x = parseFloat(tok);
    i++;
    const y = parseFloat(tokens[i] ?? "0");
    i++;
    out.push(`${r(x + dx)} ${r(y + dy)}`);
  }
  return out.length > 0 ? out.join(" ") : null;
}

/**
 * Extrai os pontos, em ordem, de um `svgPath` que só usa M/L/Z (todo `svgPath`
 * de uma parte nativa do editor é assim — ver `rectToSvgPath`/
 * `shapeGeometryToSvgPath`, nenhuma das duas emite curvas). Usado pra
 * reconstruir a silhueta real de uma parte nativa (retângulo/elipse/traço
 * livre) como um shape `draw` genérico ao reabrir o projeto — sem isso, só
 * dava pra recriar o bounding box (perdendo a forma). `null` se não houver
 * pelo menos 3 pontos (mínimo pra uma área).
 */
export function svgPathToPoints(svgPath: string | undefined): Array<{ x: number; y: number }> | null {
  if (!svgPath) return null;
  const nums = (svgPath.match(/-?\d+\.?\d*/g) ?? []).map(Number);
  if (nums.length < 6) return null;
  const points: Array<{ x: number; y: number }> = [];
  for (let i = 0; i + 1 < nums.length; i += 2) {
    points.push({ x: nums[i]!, y: nums[i + 1]! });
  }
  return points;
}
