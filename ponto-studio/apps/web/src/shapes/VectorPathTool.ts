import { StateNode, type TLStateNodeConstructor } from "@tldraw/tldraw";
import { Creating } from "./toolStates/Creating.ts";
import { Idle } from "./toolStates/Idle.ts";

/**
 * Ferramenta de caneta — clique adiciona um vértice reto, clique+arrasta
 * adiciona um vértice com handles de curva, clique perto do primeiro ponto
 * fecha o path, Enter/Esc termina aberto. Não existe tool nativo do tldraw
 * pra copiar esse fluxo (o mais próximo, `line`, só ganha pontos extras
 * depois via shift+clique em modo de edição) — state machine nova.
 */
export class VectorPathTool extends StateNode {
  static override id = "vector-path";
  static override initial = "idle";
  static override children = (): TLStateNodeConstructor[] => [Idle, Creating];

  override shapeType = "vector-path";
}
