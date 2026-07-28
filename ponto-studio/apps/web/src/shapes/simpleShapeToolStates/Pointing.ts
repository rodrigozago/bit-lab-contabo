import { StateNode, Vec, createShapeId, type TLEventHandlers } from "@tldraw/tldraw";
import { SimpleShapeKindStyle, type SimpleShape } from "../SimpleShape.ts";

/**
 * Réplica adaptada do `Pointing` do `GeoShapeTool` nativo (node_modules/
 * tldraw/src/lib/shapes/geo/toolStates/Pointing.ts): clique+arrasta cria em
 * 1x1 e delega o resize interativo pro estado nativo `select.resizing`;
 * clique simples cria com tamanho fixo centralizado no ponto clicado.
 * `hasFill`/`hasStroke`/`color` não têm seletor pré-desenho (editados depois
 * no painel de Propriedades) — só `kind` vem do style, igual o `geo` nativo
 * faz com `GeoShapeGeoStyle`.
 */
export class Pointing extends StateNode {
  static override id = "pointing";

  markId = "";

  override onPointerUp: TLEventHandlers["onPointerUp"] = () => {
    this.complete();
  };

  override onPointerMove: TLEventHandlers["onPointerMove"] = (info) => {
    if (this.editor.inputs.isDragging) {
      const { originPagePoint } = this.editor.inputs;
      const id = createShapeId();
      this.markId = `creating:${id}`;
      this.editor.mark(this.markId);

      this.editor
        .createShapes<SimpleShape>([
          {
            id,
            type: "simple-shape",
            x: originPagePoint.x,
            y: originPagePoint.y,
            props: {
              w: 1,
              h: 1,
              kind: this.editor.getStyleForNextShape(SimpleShapeKindStyle),
              hasFill: true,
              hasStroke: true,
              strokeWidth: 2,
              cornerRadius: 0,
              color: "#7c5cbf",
            },
          },
        ])
        .select(id)
        .setCurrentTool("select.resizing", {
          ...info,
          target: "selection",
          handle: "bottom_right",
          isCreating: true,
          creationCursorOffset: { x: 1, y: 1 },
          onInteractionEnd: "simple-shape",
        });
    }
  };

  override onCancel: TLEventHandlers["onCancel"] = () => {
    this.cancel();
  };

  override onComplete: TLEventHandlers["onComplete"] = () => {
    this.complete();
  };

  override onInterrupt: TLEventHandlers["onInterrupt"] = () => {
    this.cancel();
  };

  private complete() {
    const { originPagePoint } = this.editor.inputs;
    const id = createShapeId();
    this.markId = `creating:${id}`;
    this.editor.mark(this.markId);

    const kind = this.editor.getStyleForNextShape(SimpleShapeKindStyle);
    const size = { w: 200, h: 200 };

    this.editor.createShapes<SimpleShape>([
      {
        id,
        type: "simple-shape",
        x: originPagePoint.x,
        y: originPagePoint.y,
        props: { kind, hasFill: true, hasStroke: true, strokeWidth: 2, cornerRadius: 0, color: "#7c5cbf", ...size },
      },
    ]);

    const shape = this.editor.getShape<SimpleShape>(id);
    if (!shape) return;

    const { w, h } = shape.props;
    const delta = new Vec(w / 2, h / 2);
    const parentTransform = this.editor.getShapeParentTransform(shape);
    if (parentTransform) delta.rot(-parentTransform.rotation());

    this.editor.select(id);
    this.editor.updateShape<SimpleShape>({
      id: shape.id,
      type: "simple-shape",
      x: shape.x - delta.x,
      y: shape.y - delta.y,
    });

    if (this.editor.getInstanceState().isToolLocked) {
      this.parent.transition("idle");
    } else {
      this.editor.setCurrentTool("select", {});
    }
  }

  private cancel() {
    this.parent.transition("idle");
  }
}
