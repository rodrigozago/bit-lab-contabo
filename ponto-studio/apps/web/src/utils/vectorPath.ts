import type { VectorPathVertex } from "../shapes/VectorPathShape.ts";

/**
 * Utilitários do shape de path vetorial (caneta com curvas Bézier reais) —
 * separado de `geometry.ts`, que só entende M/L/Z. Alfabeto restrito a
 * M/L/C/Z por design (decisão de produto confirmada): o shape nunca gera/
 * aceita arco (A) nem atalhos (H/V/S/Q/T) — simplifica bastante o parser,
 * sem perder nada relevante pro caso de uso (curva cúbica já cobre o que se
 * desenha à mão pra bordado). Sem ambiguidade: `L` sempre é segmento reto,
 * `C` sempre é curva com pontos de controle — é o que permite reconstruir o
 * shape de volta a partir do `svgPath` salvo sem precisar de um campo novo
 * no modelo de dados compartilhado.
 */

const DEFAULT_CURVE_SEGMENTS = 16;

function round(n: number): number {
  return +n.toFixed(2);
}

/** Amostra uma curva de Bézier cúbica — mesma matemática já usada no backend
 * (`apps/api/src/services/svgTransform.ts::sampleCubicBezier`). */
function sampleCubicBezier(
  p0: { x: number; y: number },
  c1: { x: number; y: number },
  c2: { x: number; y: number },
  p1: { x: number; y: number },
  segments: number,
  push: (x: number, y: number) => void
): void {
  for (let s = 1; s <= segments; s++) {
    const t = s / segments;
    const mt = 1 - t;
    const x = mt * mt * mt * p0.x + 3 * mt * mt * t * c1.x + 3 * mt * t * t * c2.x + t * t * t * p1.x;
    const y = mt * mt * mt * p0.y + 3 * mt * mt * t * c1.y + 3 * mt * t * t * c2.y + t * t * t * p1.y;
    push(x, y);
  }
}

/**
 * Devolve uma polilinha DENSA (pontos amostrados, sem curvas) da geometria
 * do path — usada só pra hit-testing/bounds (`getGeometry` do ShapeUtil) e
 * pra recentralizar o bbox real na exportação. Os pontos de controle crus
 * continuam guardados nos vértices; esta função nunca é a fonte do "d"
 * exportado (isso é `vectorPathVerticesToSvgPath`, que preserva curvas).
 */
export function vectorPathVerticesToPolyline(
  vertices: VectorPathVertex[],
  isClosed: boolean,
  segmentsPerCurve = DEFAULT_CURVE_SEGMENTS
): Array<{ x: number; y: number }> {
  if (vertices.length === 0) return [];
  const points: Array<{ x: number; y: number }> = [{ x: vertices[0]!.x, y: vertices[0]!.y }];

  const pushSegment = (from: VectorPathVertex, to: VectorPathVertex) => {
    if (!from.cpOut && !to.cpIn) {
      points.push({ x: to.x, y: to.y });
      return;
    }
    const c1 = from.cpOut ? { x: from.x + from.cpOut.x, y: from.y + from.cpOut.y } : { x: from.x, y: from.y };
    const c2 = to.cpIn ? { x: to.x + to.cpIn.x, y: to.y + to.cpIn.y } : { x: to.x, y: to.y };
    sampleCubicBezier(from, c1, c2, to, segmentsPerCurve, (x, y) => points.push({ x, y }));
  };

  for (let i = 1; i < vertices.length; i++) pushSegment(vertices[i - 1]!, vertices[i]!);
  if (isClosed && vertices.length > 1) pushSegment(vertices[vertices.length - 1]!, vertices[0]!);

  return points;
}

/**
 * Monta o "d" real (com curvas) a partir dos vértices — qualquer handle
 * presente (`cpOut` de origem OU `cpIn` de destino) vira um `C` completo,
 * espelhando/zerando o lado sem handle (control point = a própria âncora,
 * offset zero); sem nenhum handle nos dois lados, emite `L`. Se `isClosed`,
 * o segmento de fechamento (último vértice → primeiro) é emitido
 * EXPLICITAMENTE (pode ser curva) antes do "Z" — não depende da semântica
 * implícita de "Z fecha em linha reta" do SVG.
 */
export function vectorPathVerticesToSvgPath(vertices: VectorPathVertex[], isClosed: boolean): string {
  if (vertices.length === 0) return "";

  const segmentCommand = (from: VectorPathVertex, to: VectorPathVertex): string => {
    if (!from.cpOut && !to.cpIn) {
      return `L ${round(to.x)} ${round(to.y)}`;
    }
    const c1 = from.cpOut ? { x: from.x + from.cpOut.x, y: from.y + from.cpOut.y } : { x: from.x, y: from.y };
    const c2 = to.cpIn ? { x: to.x + to.cpIn.x, y: to.y + to.cpIn.y } : { x: to.x, y: to.y };
    return `C ${round(c1.x)} ${round(c1.y)} ${round(c2.x)} ${round(c2.y)} ${round(to.x)} ${round(to.y)}`;
  };

  const parts = [`M ${round(vertices[0]!.x)} ${round(vertices[0]!.y)}`];
  for (let i = 1; i < vertices.length; i++) parts.push(segmentCommand(vertices[i - 1]!, vertices[i]!));
  if (isClosed && vertices.length > 1) parts.push(segmentCommand(vertices[vertices.length - 1]!, vertices[0]!));
  if (isClosed) parts.push("Z");

  return parts.join(" ");
}

/**
 * Inverso de `vectorPathVerticesToSvgPath` — reparseia um "d" M/L/C/Z de
 * volta em vértices. `null` se o "d" não começar com M, tiver menos de 2
 * pontos, ou usar qualquer comando fora do alfabeto restrito (A/H/V/S/Q/T —
 * nunca deveriam aparecer num "d" gerado por este shape; se aparecerem, é
 * um `svgPath` de outra origem, não um `vector-path` salvo).
 */
export function svgPathToVectorPathVertices(
  d: string | undefined
): { vertices: VectorPathVertex[]; isClosed: boolean } | null {
  if (!d) return null;
  const tokens = d.match(/[MLCZ]|-?\d*\.?\d+(?:[eE][+-]?\d+)?/g);
  if (!tokens || tokens[0] !== "M") return null;

  let i = 1; // pula o "M"
  const readNum = (): number | null => {
    const tok = tokens[i];
    if (tok === undefined || /[MLCZ]/.test(tok)) return null;
    i++;
    return parseFloat(tok);
  };

  let vid = 0;
  const nextId = () => `v${vid++}`;

  const startX = readNum();
  const startY = readNum();
  if (startX === null || startY === null) return null;

  const vertices: VectorPathVertex[] = [{ id: nextId(), x: startX, y: startY }];
  let isClosed = false;

  while (i < tokens.length) {
    const tok = tokens[i];
    if (tok === "Z") {
      isClosed = true;
      i++;
      continue;
    }
    if (tok === "L") {
      i++;
      const x = readNum(), y = readNum();
      if (x === null || y === null) return null;
      vertices.push({ id: nextId(), x, y });
      continue;
    }
    if (tok === "C") {
      i++;
      const c1x = readNum(), c1y = readNum(), c2x = readNum(), c2y = readNum(), x = readNum(), y = readNum();
      if (c1x === null || c1y === null || c2x === null || c2y === null || x === null || y === null) return null;
      const prev = vertices[vertices.length - 1]!;
      if (c1x !== prev.x || c1y !== prev.y) prev.cpOut = { x: c1x - prev.x, y: c1y - prev.y };
      const next: VectorPathVertex = { id: nextId(), x, y };
      if (c2x !== x || c2y !== y) next.cpIn = { x: c2x - x, y: c2y - y };
      vertices.push(next);
      continue;
    }
    // comando fora do alfabeto restrito (ex.: "A") — não é um vector-path
    return null;
  }

  if (vertices.length < 2) return null;

  // Fechado: o segmento de fechamento explícito (seção acima) cria um
  // vértice DUPLICADO do primeiro — funde os handles nele em vez de manter
  // um vértice repetido.
  if (isClosed) {
    const first = vertices[0]!;
    const last = vertices[vertices.length - 1]!;
    if (Math.abs(last.x - first.x) < 0.01 && Math.abs(last.y - first.y) < 0.01) {
      if (last.cpIn) first.cpIn = last.cpIn;
      vertices.pop();
    }
  }

  if (vertices.length < 2) return null;
  return { vertices, isClosed };
}

/**
 * Escala e translada TODOS os pontos de cada vértice — âncora E os offsets
 * `cpIn`/`cpOut` (que só precisam ser escalados, nunca transladados, porque
 * já são relativos à âncora). Variante de `scalePoints` (`geometry.ts`) que
 * entende vértices com handles, usada em `insertTemplate` pra reposicionar
 * uma matriz da biblioteca preservando a curvatura de verdade.
 */
export function scaleVectorPathVertices(
  vertices: VectorPathVertex[],
  scale: number,
  destX: number,
  destY: number
): VectorPathVertex[] {
  return vertices.map((v) => ({
    id: v.id,
    x: destX + v.x * scale,
    y: destY + v.y * scale,
    ...(v.cpIn ? { cpIn: { x: v.cpIn.x * scale, y: v.cpIn.y * scale } } : {}),
    ...(v.cpOut ? { cpOut: { x: v.cpOut.x * scale, y: v.cpOut.y * scale } } : {}),
  }));
}

/**
 * Monta o "d" exportável de um shape `vector-path` já posicionado no canvas
 * (shape-local + `shape.x`/`shape.y`), recentralizado pra que o CENTRO do
 * bbox real (poligonalizado densamente só pra calcular o bbox, nunca pra
 * exportar) caia em `center` — mesma convenção de `shapeGeometryToSvgPath`
 * (`geometry.ts`). `null` se não houver vértices suficientes ou a geometria
 * for degenerada (sem área).
 */
export function vectorPathShapeToSvgPath(
  shape: { x: number; y: number; props: { vertices: VectorPathVertex[]; isClosed: boolean } },
  center: { x: number; y: number }
): string | null {
  const { vertices, isClosed } = shape.props;
  if (vertices.length < 2) return null;

  const pageVertices = vertices.map((v) => ({ ...v, x: v.x + shape.x, y: v.y + shape.y }));

  const polyline = vectorPathVerticesToPolyline(pageVertices, isClosed);
  if (polyline.length === 0) return null;
  const xs = polyline.map((p) => p.x);
  const ys = polyline.map((p) => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  if (!(maxX > minX) || !(maxY > minY)) return null;

  const dx = center.x - (minX + maxX) / 2;
  const dy = center.y - (minY + maxY) / 2;
  const centeredVertices = pageVertices.map((v) => ({ ...v, x: v.x + dx, y: v.y + dy }));

  return vectorPathVerticesToSvgPath(centeredVertices, isClosed);
}
