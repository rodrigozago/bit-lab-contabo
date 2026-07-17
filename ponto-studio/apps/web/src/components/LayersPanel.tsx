import { useEffect, useMemo, useState } from "react";
import type { Editor as TldrawEditor, TLShape, TLShapeId } from "@tldraw/tldraw";

interface Props {
  editor: TldrawEditor | null;
}

interface LayerGroup {
  groupId: string;
  name: string;
  referenceShapeId?: TLShapeId;
  embroideryShapeIds: TLShapeId[];
}

/** Agrupa os shapes da página por meta.importGroupId — cada importação (foto
 * ou texto) vira um grupo com sub-camadas "Imagem de referência" e "Bordado",
 * estilo Photoshop. Shapes sem importGroupId (formas desenhadas manualmente)
 * caem numa entrada avulsa "Formas soltas". */
function computeGroups(editor: TldrawEditor | null): { groups: LayerGroup[]; looseShapeIds: TLShapeId[] } {
  if (!editor) return { groups: [], looseShapeIds: [] };

  const shapes = editor
    .getCurrentPageShapes()
    .filter((s) => s.meta?.["layer"] === "reference" || s.meta?.["layer"] === "embroidery");

  const byGroup = new Map<string, LayerGroup>();
  const looseShapeIds: TLShapeId[] = [];

  for (const shape of shapes) {
    const groupId = shape.meta?.["importGroupId"] as string | undefined;
    if (!groupId) {
      looseShapeIds.push(shape.id);
      continue;
    }
    if (!byGroup.has(groupId)) {
      byGroup.set(groupId, {
        groupId,
        name: (shape.meta?.["importGroupName"] as string | undefined) ?? "Bordado",
        embroideryShapeIds: [],
      });
    }
    const group = byGroup.get(groupId)!;
    if (shape.meta?.["layer"] === "reference") {
      group.referenceShapeId = shape.id;
    } else {
      group.embroideryShapeIds.push(shape.id);
    }
  }

  return { groups: [...byGroup.values()], looseShapeIds };
}

/** Esconde/mostra um conjunto de shapes (mesmo truque já usado pro toggle
 * global antigo: isLocked trava seleção, opacity 0 esconde visualmente,
 * meta.prevOpacity guarda o valor pra restaurar). */
function setShapesHidden(editor: TldrawEditor, ids: TLShapeId[], hidden: boolean) {
  const shapes = ids.map((id) => editor.getShape(id)).filter((s): s is TLShape => !!s);
  if (shapes.length === 0) return;

  if (hidden) {
    editor.setSelectedShapes(editor.getSelectedShapeIds().filter((id) => !ids.includes(id)));
    editor.updateShapes(
      shapes.map((s) => ({
        id: s.id, type: s.type, isLocked: true, opacity: 0,
        meta: { ...s.meta, prevOpacity: s.opacity },
      }))
    );
  } else {
    editor.updateShapes(
      shapes.map((s) => ({
        id: s.id, type: s.type, isLocked: false,
        opacity: (s.meta?.["prevOpacity"] as number | undefined) ?? 1,
      }))
    );
  }
}

function isHidden(editor: TldrawEditor, ids: TLShapeId[]): boolean {
  if (ids.length === 0) return false;
  return ids.every((id) => editor.getShape(id)?.isLocked);
}

export function LayersPanel({ editor }: Props) {
  const [tick, setTick] = useState(0);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!editor) return;
    const unlisten = editor.store.listen(() => setTick((t) => t + 1), { scope: "document" });
    return () => unlisten();
  }, [editor]);

  const { groups, looseShapeIds } = useMemo(
    () => computeGroups(editor),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editor, tick]
  );

  function toggleGroupCollapse(groupId: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }

  function toggle(ids: TLShapeId[]) {
    if (!editor || ids.length === 0) return;
    setShapesHidden(editor, ids, !isHidden(editor, ids));
  }

  if (!editor) return null;

  return (
    <div style={styles.root}>
      <div style={styles.header}>
        <span style={styles.title}>Camadas</span>
      </div>
      <div style={styles.list}>
        {groups.length === 0 && looseShapeIds.length === 0 && (
          <p style={styles.empty}>Importe uma imagem ou adicione texto pra ver as camadas aqui.</p>
        )}

        {groups.map((group) => {
          const isCollapsed = collapsed.has(group.groupId);
          const refHidden = group.referenceShapeId ? isHidden(editor, [group.referenceShapeId]) : false;
          const embHidden = isHidden(editor, group.embroideryShapeIds);
          return (
            <div key={group.groupId} style={styles.group}>
              <button style={styles.groupHeader} onClick={() => toggleGroupCollapse(group.groupId)}>
                <span style={styles.chevron}>{isCollapsed ? "▸" : "▾"}</span>
                <span style={styles.groupIcon}>🗂️</span>
                <span style={styles.groupName}>{group.name}</span>
              </button>
              {!isCollapsed && (
                <div style={styles.subList}>
                  {group.referenceShapeId && (
                    <label style={styles.subItem}>
                      <input
                        type="checkbox"
                        checked={!refHidden}
                        onChange={() => toggle([group.referenceShapeId!])}
                      />
                      <span style={styles.subLabel}>📷 Imagem de referência</span>
                    </label>
                  )}
                  <label style={styles.subItem}>
                    <input
                      type="checkbox"
                      checked={!embHidden}
                      onChange={() => toggle(group.embroideryShapeIds)}
                    />
                    <span style={styles.subLabel}>🪡 Bordado</span>
                  </label>
                </div>
              )}
            </div>
          );
        })}

        {looseShapeIds.length > 0 && (
          <label style={styles.item}>
            <input
              type="checkbox"
              checked={!isHidden(editor, looseShapeIds)}
              onChange={() => toggle(looseShapeIds)}
            />
            <span style={styles.label}>✏️ Formas soltas</span>
          </label>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: { borderTop: "1px solid #e2e0db" },
  header: { padding: "12px 16px", borderBottom: "1px solid #e2e0db" },
  title: {
    fontSize: 12, fontWeight: 700, textTransform: "uppercase",
    letterSpacing: "0.08em", color: "#6b6b6b",
  },
  list: { display: "flex", flexDirection: "column", padding: "6px 0", maxHeight: 220, overflowY: "auto" },
  empty: { fontSize: 12, color: "#9b9b9b", padding: "8px 16px", margin: 0 },
  group: { display: "flex", flexDirection: "column" },
  groupHeader: {
    display: "flex", alignItems: "center", gap: 6, padding: "6px 16px",
    border: "none", background: "transparent", cursor: "pointer", textAlign: "left",
    fontSize: 12.5, fontWeight: 600, color: "#1a1a1a",
  },
  chevron: { fontSize: 10, color: "#9b9b9b", width: 10, flexShrink: 0 },
  groupIcon: { fontSize: 13 },
  groupName: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  subList: { display: "flex", flexDirection: "column", paddingLeft: 8 },
  subItem: {
    display: "flex", alignItems: "center", gap: 8, padding: "6px 16px 6px 26px",
    cursor: "pointer", fontSize: 12.5,
  },
  subLabel: { color: "#1a1a1a", userSelect: "none" },
  item: {
    display: "flex", alignItems: "center", gap: 8, padding: "8px 16px",
    cursor: "pointer", fontSize: 13, marginTop: 4, borderTop: "1px solid #f0ede8",
  },
  label: { color: "#1a1a1a", userSelect: "none" },
};
