import {
  Polygon2d,
  Polyline2d,
  SVGContainer,
  ShapeUtil,
  Vec,
  getIndices,
  type TLHandle,
  type TLOnHandleDragHandler,
  type TLOnResizeHandler,
} from "@tldraw/tldraw";
import { vectorPathVerticesToPolyline, vectorPathVerticesToSvgPath } from "../utils/vectorPath.ts";
import {
  vectorPathShapeMigrations,
  vectorPathShapeProps,
  type VectorPathShape,
  type VectorPathVertex,
} from "./VectorPathShape.ts";

/**
 * Shape customizado de path vetorial — a "caneta" com curvas Bézier reais e
 * edição de nó/âncora que faltava no editor (motor de canvas continua sendo
 * o tldraw 2.4.6 já instalado, sem custo de licença; ver plano de decisão).
 *
 * Ponto-chave de design: `getGeometry()` devolve uma poligonalização DENSA
 * (via `vectorPathVerticesToPolyline`) só pra hit-testing/seleção/bounds —
 * os `props.vertices` continuam guardando os dados de curva CRUS. A
 * exportação real (`toSvg`, e a captura pro domínio em `Editor.tsx` via
 * `vectorPathShapeToSvgPath`) nunca passa pela geometria poligonalizada, vai
 * direto dos vértices pro "d" com `C`. Sem essa separação, isto seria só uma
 * reimplementação do shape `draw` nativo com outra UI.
 */
export class VectorPathShapeUtil extends ShapeUtil<VectorPathShape> {
  static override type = "vector-path" as const;
  static override props = vectorPathShapeProps;
  static override migrations = vectorPathShapeMigrations;

  // Duplo-clique entra em modo de edição (mostra os handles de âncora/
  // controle); esconde a moldura de seleção padrão nesse modo, mesmo padrão
  // do exemplo oficial de shape Bézier do tldraw.
  override canEdit = () => true;
  override hideSelectionBoundsBg = () => true;
  override hideSelectionBoundsFg = () => true;

  override getDefaultProps(): VectorPathShape["props"] {
    return { vertices: [], isClosed: false, color: "#7c5cbf" };
  }

  getGeometry(shape: VectorPathShape) {
    const { vertices, isClosed } = shape.props;
    const polyline = vectorPathVerticesToPolyline(vertices, isClosed).map((p) => new Vec(p.x, p.y));
    if (isClosed) {
      return new Polygon2d({ points: polyline, isFilled: true });
    }
    return new Polyline2d({ points: polyline });
  }

  /**
   * 1 handle `vertex` por âncora + até 2 por `cpIn`/`cpOut` presente. O tipo
   * de vértice/controle é distinguido pelo PREFIXO do id (`anchor:`/`cpIn:`/
   * `cpOut:`), não pelo `handle.type` do tldraw (todos usam "vertex" — é o
   * tipo que o SDK arrasta nativamente via `select.dragging_handle`;
   * `onHandleDrag` faz o dispatch por id).
   */
  override getHandles(shape: VectorPathShape): TLHandle[] {
    const { vertices } = shape.props;
    const indices = getIndices(vertices.length * 3); // espaço de sobra pra âncora + 2 controles
    let ii = 0;
    const handles: TLHandle[] = [];
    for (const v of vertices) {
      handles.push({ id: `anchor:${v.id}`, type: "vertex", index: indices[ii++]!, x: v.x, y: v.y, canSnap: true });
      if (v.cpIn) {
        handles.push({
          id: `cpIn:${v.id}`, type: "vertex", index: indices[ii++]!,
          x: v.x + v.cpIn.x, y: v.y + v.cpIn.y, canSnap: false,
        });
      }
      if (v.cpOut) {
        handles.push({
          id: `cpOut:${v.id}`, type: "vertex", index: indices[ii++]!,
          x: v.x + v.cpOut.x, y: v.y + v.cpOut.y, canSnap: false,
        });
      }
    }
    return handles;
  }

  component(shape: VectorPathShape) {
    return (
      <SVGContainer id={shape.id}>
        <VectorPathSvg shape={shape} />
      </SVGContainer>
    );
  }

  indicator(shape: VectorPathShape) {
    return <path d={pathData(shape.props.vertices, shape.props.isClosed)} />;
  }

  override toSvg(shape: VectorPathShape) {
    return <VectorPathSvg shape={shape} />;
  }

  override onResize: TLOnResizeHandler<VectorPathShape> = (shape, info) => {
    const { scaleX, scaleY } = info;
    return {
      props: {
        vertices: shape.props.vertices.map((v) => scaleVertex(v, scaleX, scaleY)),
      },
    };
  };

  /**
   * Mover a âncora desloca âncora + os 2 handles junto de graça (offsets são
   * RELATIVOS, então só a âncora muda). Mover um handle de controle só
   * atualiza aquele offset — sem espelhamento automático depois da criação
   * (o espelho simétrico só acontece uma vez, no momento de criar o vértice
   * via clique+arrasto; edição posterior de cada handle é independente, mais
   * simples de raciocinar e suficiente pro caso de uso).
   */
  override onHandleDrag: TLOnHandleDragHandler<VectorPathShape> = (shape, { handle }) => {
    const sep = handle.id.indexOf(":");
    if (sep === -1) return;
    const kind = handle.id.slice(0, sep);
    const vertexId = handle.id.slice(sep + 1);

    const vertices = shape.props.vertices.map((v) => {
      if (v.id !== vertexId) return v;
      if (kind === "anchor") return { ...v, x: handle.x, y: handle.y };
      if (kind === "cpIn") return { ...v, cpIn: { x: handle.x - v.x, y: handle.y - v.y } };
      if (kind === "cpOut") return { ...v, cpOut: { x: handle.x - v.x, y: handle.y - v.y } };
      return v;
    });

    return { id: shape.id, type: shape.type, props: { vertices } };
  };
}

function scaleVertex(v: VectorPathVertex, scaleX: number, scaleY: number): VectorPathVertex {
  return {
    id: v.id,
    x: v.x * scaleX,
    y: v.y * scaleY,
    ...(v.cpIn ? { cpIn: { x: v.cpIn.x * scaleX, y: v.cpIn.y * scaleY } } : {}),
    ...(v.cpOut ? { cpOut: { x: v.cpOut.x * scaleX, y: v.cpOut.y * scaleY } } : {}),
  };
}

function pathData(vertices: VectorPathVertex[], isClosed: boolean): string {
  if (vertices.length < 2) {
    // shape recém-criado com 1 vértice só (ainda desenhando) — um ponto
    // sem área; desenha um "M" sozinho, inofensivo (sem "L"/"C" a seguir).
    return vertices.length === 1 ? `M ${vertices[0]!.x} ${vertices[0]!.y}` : "";
  }
  return vectorPathVerticesToSvgPath(vertices, isClosed);
}

function VectorPathSvg({ shape }: { shape: VectorPathShape }) {
  const { vertices, isClosed, color } = shape.props;
  const d = pathData(vertices, isClosed);
  if (!d) return null;
  return <path d={d} fill={isClosed ? color : "none"} stroke={color} strokeWidth={2} />;
}
