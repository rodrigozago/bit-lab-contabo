import {
  StyleProp,
  T,
  createShapePropsMigrationIds,
  createShapePropsMigrationSequence,
  type RecordProps,
  type TLBaseShape,
} from "@tldraw/tldraw";

/**
 * Estilo do "kind" (retângulo vs. círculo) — precisa ser um `StyleProp` de
 * verdade (não um enum validado à parte) pra a toolbar poder chamar
 * `editor.setStyleForNextShapes(SimpleShapeKindStyle, "rectangle"|"ellipse")`
 * ANTES de ativar a ferramenta, e a tool ler de volta com
 * `getStyleForNextShape` — mesmo mecanismo que o `geo` nativo usa com
 * `GeoShapeGeoStyle` (ver node_modules/@tldraw/tlschema/src/shapes/TLGeoShape.ts).
 */
export const SimpleShapeKindStyle = StyleProp.defineEnum("ponto-studio:simpleShapeKind", {
  defaultValue: "rectangle",
  values: ["rectangle", "ellipse"],
});

export type SimpleShapeKind = T.TypeOf<typeof SimpleShapeKindStyle>;

export interface SimpleShapeProps {
  kind: SimpleShapeKind;
  w: number;
  h: number;
  hasFill: boolean;
  hasStroke: boolean;
  strokeWidth: number;
  /** raio dos cantos, em px de canvas — só lido quando kind === "rectangle"
   *  (círculo não tem canto). 0 = cantos retos, o default. */
  cornerRadius: number;
  color: string;
}

export type SimpleShape = TLBaseShape<"simple-shape", SimpleShapeProps>;

export const simpleShapeProps: RecordProps<SimpleShape> = {
  kind: SimpleShapeKindStyle,
  w: T.number,
  h: T.number,
  hasFill: T.boolean,
  hasStroke: T.boolean,
  strokeWidth: T.number,
  cornerRadius: T.number,
  color: T.string,
};

// Mesmo vazias no dia 1 — sem isso, qualquer mudança futura na forma dos
// props quebra projetos salvos sem aviso (mesmo padrão de VectorPathShape.ts).
export const simpleShapeVersions = createShapePropsMigrationIds("simple-shape", {});

export const simpleShapeMigrations = createShapePropsMigrationSequence({
  sequence: [],
});
