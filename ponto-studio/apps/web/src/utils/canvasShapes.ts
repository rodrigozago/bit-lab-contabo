import type { Editor as TldrawEditor, TLShape, TLShapeId } from "@tldraw/tldraw";

/**
 * Esconde/mostra shapes do tldraw sem deletá-los: isLocked trava a seleção,
 * opacity 0 esconde, e meta.prevOpacity guarda o valor pra restaurar. É o mesmo
 * truque usado pela visibilidade das partes (element.hidden) e pelos toggles
 * auxiliares (foto de referência / formas soltas).
 */
export function setShapesHidden(editor: TldrawEditor, ids: TLShapeId[], hidden: boolean) {
  const shapes = ids.map((id) => editor.getShape(id)).filter((s): s is TLShape => !!s);
  if (shapes.length === 0) return;

  if (hidden) {
    editor.setSelectedShapes(editor.getSelectedShapeIds().filter((id) => !ids.includes(id)));
    editor.updateShapes(
      shapes.map((s) => ({
        id: s.id,
        type: s.type,
        isLocked: true,
        opacity: 0,
        meta: { ...s.meta, prevOpacity: s.opacity },
      })),
    );
  } else {
    editor.updateShapes(
      shapes.map((s) => ({
        id: s.id,
        type: s.type,
        isLocked: false,
        opacity: (s.meta?.["prevOpacity"] as number | undefined) ?? 1,
      })),
    );
  }
}

/** Todos os shapes do conjunto estão ocultos? (usado pelos toggles auxiliares) */
export function isHidden(editor: TldrawEditor, ids: TLShapeId[]): boolean {
  if (ids.length === 0) return false;
  return ids.every((id) => editor.getShape(id)?.isLocked);
}

/** Acha o shape do canvas vinculado a uma parte (meta.elementId). */
export function findShapeByElementId(
  editor: TldrawEditor,
  elementId: string,
): TLShape | undefined {
  return editor.getCurrentPageShapes().find((s) => s.meta?.["elementId"] === elementId);
}
