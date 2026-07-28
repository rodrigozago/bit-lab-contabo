import { T, createShapePropsMigrationIds, createShapePropsMigrationSequence, type RecordProps, type TLBaseShape } from "@tldraw/tldraw";

/**
 * Um vértice do path — âncora + até 2 handles de curva, RELATIVOS à âncora
 * (não absolutos). Offset relativo simplifica escalar/mover/desacoplar em
 * relação a guardar o ponto de controle absoluto (mesmo raciocínio de design
 * usado por editores vetoriais tipo Illustrator/Figma). Vértice sem
 * `cpIn`/`cpOut` = segmento reto — permite misturar retas e curvas no mesmo
 * path (cantos vivos + curvas, ex. folha/coração).
 */
export interface VectorPathVertex {
  id: string;
  x: number;
  y: number;
  /** offset relativo à âncora — ponto de controle de ENTRADA (curva vindo de trás) */
  cpIn?: { x: number; y: number };
  /** offset relativo à âncora — ponto de controle de SAÍDA (curva indo pra frente) */
  cpOut?: { x: number; y: number };
}

const vectorPathVertexValidator: T.ObjectValidator<VectorPathVertex> = T.object({
  id: T.string,
  x: T.number,
  y: T.number,
  cpIn: T.object({ x: T.number, y: T.number }).optional(),
  cpOut: T.object({ x: T.number, y: T.number }).optional(),
});

export interface VectorPathShapeProps {
  vertices: VectorPathVertex[];
  /** fechado (área de preenchimento) ou aberto (linha/contorno) — os dois são suportados */
  isClosed: boolean;
  color: string;
}

export type VectorPathShape = TLBaseShape<"vector-path", VectorPathShapeProps>;

export const vectorPathShapeProps: RecordProps<VectorPathShape> = {
  vertices: T.arrayOf(vectorPathVertexValidator),
  isClosed: T.boolean,
  color: T.string,
};

// Mesmo vazias no dia 1 — sem isso, qualquer mudança futura na forma dos
// props quebra projetos salvos sem aviso (padrão real de TLLineShape.ts).
export const vectorPathShapeVersions = createShapePropsMigrationIds("vector-path", {});

export const vectorPathShapeMigrations = createShapePropsMigrationSequence({
  sequence: [],
});
