import type { Editor as TldrawEditor, TLShapeId } from "@tldraw/tldraw";

interface Props {
  editor: TldrawEditor | null;
  selectedShapeIds: TLShapeId[];
}

/**
 * Ferramentas de manipulação (grupo/rotacionar/espelhar/alinhar/distribuir) —
 * chamam a API do tldraw direto (editor.groupShapes/rotateShapesBy/etc já
 * existem prontas), essa UI só torna essas ações descobríveis no app sem
 * depender do usuário saber do menu de contexto (botão direito) do tldraw.
 */
export function ShapeActionsPanel({ editor, selectedShapeIds }: Props) {
  const count = selectedShapeIds.length;
  const canGroup = count >= 2;
  const canTransform = count >= 1;
  const canAlign = count >= 2;
  const canDistribute = count >= 3;
  const canUngroup =
    count >= 1 && selectedShapeIds.some((id) => editor?.getShape(id)?.type === "group");

  function run(fn: (editor: TldrawEditor) => void) {
    if (!editor) return;
    fn(editor);
  }

  return (
    <div style={styles.root}>
      <div style={styles.header}>
        <span style={styles.title}>Ferramentas</span>
      </div>
      <div style={styles.grid}>
        <button
          style={styles.btn}
          disabled={!canGroup}
          onClick={() => run((e) => e.groupShapes(selectedShapeIds))}
        >
          ⛓️ Agrupar
        </button>
        <button
          style={styles.btn}
          disabled={!canUngroup}
          onClick={() => run((e) => e.ungroupShapes(selectedShapeIds))}
        >
          ✂️ Desagrupar
        </button>
        <button
          style={styles.btn}
          disabled={!canTransform}
          onClick={() => run((e) => e.rotateShapesBy(selectedShapeIds, -Math.PI / 2))}
        >
          ⟲ Girar
        </button>
        <button
          style={styles.btn}
          disabled={!canTransform}
          onClick={() => run((e) => e.rotateShapesBy(selectedShapeIds, Math.PI / 2))}
        >
          ⟳ Girar
        </button>
        <button
          style={styles.btn}
          disabled={!canTransform}
          onClick={() => run((e) => e.flipShapes(selectedShapeIds, "horizontal"))}
        >
          ⇋ Espelhar H
        </button>
        <button
          style={styles.btn}
          disabled={!canTransform}
          onClick={() => run((e) => e.flipShapes(selectedShapeIds, "vertical"))}
        >
          ⇅ Espelhar V
        </button>
      </div>

      <div style={styles.subLabel}>Alinhar</div>
      <div style={styles.grid}>
        <button style={styles.btn} disabled={!canAlign} onClick={() => run((e) => e.alignShapes(selectedShapeIds, "left"))}>
          ⯇ Esquerda
        </button>
        <button style={styles.btn} disabled={!canAlign} onClick={() => run((e) => e.alignShapes(selectedShapeIds, "center-horizontal"))}>
          ⯐ Centro H
        </button>
        <button style={styles.btn} disabled={!canAlign} onClick={() => run((e) => e.alignShapes(selectedShapeIds, "right"))}>
          ⯈ Direita
        </button>
        <button style={styles.btn} disabled={!canAlign} onClick={() => run((e) => e.alignShapes(selectedShapeIds, "top"))}>
          ⯅ Topo
        </button>
        <button style={styles.btn} disabled={!canAlign} onClick={() => run((e) => e.alignShapes(selectedShapeIds, "center-vertical"))}>
          ⯐ Centro V
        </button>
        <button style={styles.btn} disabled={!canAlign} onClick={() => run((e) => e.alignShapes(selectedShapeIds, "bottom"))}>
          ⯆ Base
        </button>
      </div>

      <div style={styles.subLabel}>Distribuir</div>
      <div style={styles.grid}>
        <button style={styles.btn} disabled={!canDistribute} onClick={() => run((e) => e.distributeShapes(selectedShapeIds, "horizontal"))}>
          ↔ Horizontal
        </button>
        <button style={styles.btn} disabled={!canDistribute} onClick={() => run((e) => e.distributeShapes(selectedShapeIds, "vertical"))}>
          ↕ Vertical
        </button>
      </div>

      {count === 0 && <p style={styles.hint}>Selecione formas no canvas pra habilitar as ferramentas.</p>}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: { borderTop: "1px solid #e2e0db", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8 },
  header: { marginBottom: 2 },
  title: {
    fontSize: 12, fontWeight: 700, textTransform: "uppercase",
    letterSpacing: "0.08em", color: "#6b6b6b",
  },
  subLabel: { fontSize: 11, fontWeight: 600, color: "#9b9b9b", marginTop: 4 },
  grid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 },
  btn: {
    padding: "7px 8px", borderRadius: 7, border: "1.5px solid #e2e0db",
    background: "#fff", fontSize: 11.5, cursor: "pointer", color: "#1a1a1a",
    transition: "all 0.12s",
  },
  hint: { fontSize: 11, color: "#9b9b9b", margin: "2px 0 0" },
};
