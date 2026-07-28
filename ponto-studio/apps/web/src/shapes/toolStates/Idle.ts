import { StateNode, createShapeId, type TLEventHandlers } from "@tldraw/tldraw";
import type { VectorPathShape } from "../VectorPathShape.ts";

/** Aguardando o primeiro clique — cria o shape no ponto clicado (shape.x/y =
 * ponto de página; primeiro vértice na origem local 0,0) e transita pra
 * "creating". */
export class Idle extends StateNode {
  static override id = "idle";

  override onEnter = () => {
    this.editor.setCursor({ type: "cross", rotation: 0 });
  };

  override onPointerDown: TLEventHandlers["onPointerDown"] = () => {
    const { currentPagePoint } = this.editor.inputs;
    const id = createShapeId();

    this.editor.mark(`creating:${id}`);
    this.editor.createShapes<VectorPathShape>([
      {
        id,
        type: "vector-path",
        x: currentPagePoint.x,
        y: currentPagePoint.y,
        props: { vertices: [{ id: "v0", x: 0, y: 0 }], isClosed: false, color: "#7c5cbf" },
      },
    ]);

    this.parent.transition("creating", { shapeId: id });
  };

  override onCancel = () => {
    this.editor.setCurrentTool("select");
  };
}
