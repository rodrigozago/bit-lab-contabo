import { StateNode, Vec, type TLEventHandlers, type TLShapeId } from "@tldraw/tldraw";
import type { VectorPathShape, VectorPathVertex } from "../VectorPathShape.ts";

/** Raio de captura (em px de TELA, não de página) pra clicar perto do
 * primeiro vértice e fechar o path — dividido pelo zoom pra virar page-px. */
const CLOSE_THRESHOLD_SCREEN_PX = 8;

/**
 * Acumula vértices enquanto o usuário desenha: clique simples = vértice
 * reto; clique perto do primeiro vértice (com pelo menos 3 já colocados) =
 * fecha o path; Enter/Esc = termina aberto; Backspace = remove o último
 * vértice sem sair do modo de criação; arrastar antes de soltar o botão =
 * handle de curva simétrico (cpOut na direção do arrasto, cpIn espelhado —
 * mesma convenção de "âncora suave" da maioria dos editores vetoriais).
 */
export class Creating extends StateNode {
  static override id = "creating";

  private shapeId: TLShapeId = "" as TLShapeId;
  private isPointerDown = false;
  private dragStart: Vec | null = null;

  override onEnter = (info: { shapeId: TLShapeId }) => {
    this.shapeId = info.shapeId;
    this.editor.setCursor({ type: "cross", rotation: 0 });
  };

  override onPointerDown: TLEventHandlers["onPointerDown"] = () => {
    const shape = this.editor.getShape<VectorPathShape>(this.shapeId);
    if (!shape) return;
    const { currentPagePoint } = this.editor.inputs;
    const vertices = shape.props.vertices;

    // Clique perto do primeiro vértice (com forma o bastante já desenhada) → fecha.
    if (vertices.length >= 3) {
      const first = vertices[0]!;
      const firstPage = new Vec(first.x + shape.x, first.y + shape.y);
      const thresholdPagePx = CLOSE_THRESHOLD_SCREEN_PX / this.editor.getZoomLevel();
      if (Vec.Dist(currentPagePoint, firstPage) <= thresholdPagePx) {
        this.editor.updateShapes<VectorPathShape>([
          { id: shape.id, type: "vector-path", props: { isClosed: true } },
        ]);
        this.finish();
        return;
      }
    }

    const local = { x: currentPagePoint.x - shape.x, y: currentPagePoint.y - shape.y };
    const newVertex: VectorPathVertex = { id: `v${vertices.length}`, x: local.x, y: local.y };
    this.editor.updateShapes<VectorPathShape>([
      { id: shape.id, type: "vector-path", props: { vertices: [...vertices, newVertex] } },
    ]);

    this.isPointerDown = true;
    this.dragStart = currentPagePoint.clone();
  };

  override onPointerMove: TLEventHandlers["onPointerMove"] = () => {
    if (!this.isPointerDown || !this.dragStart) return;
    if (!this.editor.inputs.isDragging) return;
    const shape = this.editor.getShape<VectorPathShape>(this.shapeId);
    if (!shape) return;

    const { currentPagePoint } = this.editor.inputs;
    const delta = { x: currentPagePoint.x - this.dragStart.x, y: currentPagePoint.y - this.dragStart.y };
    const vertices = [...shape.props.vertices];
    const last = vertices[vertices.length - 1];
    if (!last) return;
    vertices[vertices.length - 1] = {
      ...last,
      cpOut: delta,
      cpIn: { x: -delta.x, y: -delta.y },
    };

    this.editor.updateShapes<VectorPathShape>([{ id: shape.id, type: "vector-path", props: { vertices } }]);
  };

  override onPointerUp: TLEventHandlers["onPointerUp"] = () => {
    this.isPointerDown = false;
    this.dragStart = null;
  };

  override onKeyDown: TLEventHandlers["onKeyDown"] = (info) => {
    if (info.key === "Enter" || info.key === "Escape") {
      this.finishOrDiscard();
      return;
    }
    if (info.key === "Backspace" || info.key === "Delete") {
      const shape = this.editor.getShape<VectorPathShape>(this.shapeId);
      if (!shape) return;
      if (shape.props.vertices.length <= 1) {
        this.editor.deleteShapes([this.shapeId]);
        this.parent.transition("idle");
        return;
      }
      this.editor.updateShapes<VectorPathShape>([
        { id: shape.id, type: "vector-path", props: { vertices: shape.props.vertices.slice(0, -1) } },
      ]);
    }
  };

  override onCancel: TLEventHandlers["onCancel"] = () => {
    this.finishOrDiscard();
  };

  override onComplete: TLEventHandlers["onComplete"] = () => {
    this.finishOrDiscard();
  };

  override onInterrupt = () => {
    this.finishOrDiscard();
  };

  /** Enter/Esc/cancelar: descarta se não formou path válido (< 2 vértices), senão termina aberto. */
  private finishOrDiscard() {
    const shape = this.editor.getShape<VectorPathShape>(this.shapeId);
    if (shape && shape.props.vertices.length < 2) {
      this.editor.deleteShapes([this.shapeId]);
    }
    this.finish();
  }

  private finish() {
    this.editor.setCurrentTool("select");
    this.editor.snaps.clearIndicators();
  }
}
