import { StateNode, type TLStateNodeConstructor } from "@tldraw/tldraw";
import { Idle } from "./simpleShapeToolStates/Idle.ts";
import { Pointing } from "./simpleShapeToolStates/Pointing.ts";

/**
 * Ferramenta de Retângulo/Círculo customizada — substitui o `geo` nativo
 * (que só suporta a paleta de cores fixa do tldraw). Réplica quase literal do
 * `GeoShapeTool` nativo (node_modules/tldraw/src/lib/shapes/geo/
 * GeoShapeTool.ts) — clique+arrasta delega pro resize nativo
 * `select.resizing`, sem state machine própria de tracking.
 */
export class SimpleShapeTool extends StateNode {
  static override id = "simple-shape";
  static override initial = "idle";
  static override children = (): TLStateNodeConstructor[] => [Idle, Pointing];

  override shapeType = "simple-shape";
}
