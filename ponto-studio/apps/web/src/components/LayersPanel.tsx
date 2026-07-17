import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Folder, Image as ImageIcon, PenLine } from "lucide-react";
import type { Editor as TldrawEditor, TLShape, TLShapeId } from "@tldraw/tldraw";
import { cn } from "@/lib/utils.ts";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible.tsx";
import { SidebarGroup, SidebarGroupContent, SidebarGroupLabel } from "@/components/ui/sidebar.tsx";

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
    <SidebarGroup>
      <SidebarGroupLabel>Camadas</SidebarGroupLabel>
      <SidebarGroupContent className="flex max-h-56 flex-col gap-0.5 overflow-y-auto">
        {groups.length === 0 && looseShapeIds.length === 0 && (
          <p className="px-2 py-1.5 text-xs text-muted-foreground">
            Importe uma imagem ou adicione texto pra ver as camadas aqui.
          </p>
        )}

        {groups.map((group) => {
          const isCollapsed = collapsed.has(group.groupId);
          const refHidden = group.referenceShapeId ? isHidden(editor, [group.referenceShapeId]) : false;
          const embHidden = isHidden(editor, group.embroideryShapeIds);
          return (
            <Collapsible
              key={group.groupId}
              open={!isCollapsed}
              onOpenChange={() => toggleGroupCollapse(group.groupId)}
            >
              <CollapsibleTrigger className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-xs font-semibold hover:bg-sidebar-accent">
                <ChevronRight className={cn("h-3 w-3 shrink-0 transition-transform", !isCollapsed && "rotate-90")} />
                <Folder className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{group.name}</span>
              </CollapsibleTrigger>
              <CollapsibleContent className="flex flex-col gap-0.5 pb-1 pl-6">
                {group.referenceShapeId && (
                  <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-xs">
                    <Checkbox
                      checked={!refHidden}
                      onCheckedChange={() => toggle([group.referenceShapeId!])}
                    />
                    <ImageIcon className="h-3.5 w-3.5 shrink-0" />
                    Imagem de referência
                  </label>
                )}
                <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-xs">
                  <Checkbox checked={!embHidden} onCheckedChange={() => toggle(group.embroideryShapeIds)} />
                  <span>🪡</span>
                  Bordado
                </label>
              </CollapsibleContent>
            </Collapsible>
          );
        })}

        {looseShapeIds.length > 0 && (
          <label className="mt-1 flex cursor-pointer items-center gap-2 border-t px-2 py-1.5 pt-2 text-xs">
            <Checkbox checked={!isHidden(editor, looseShapeIds)} onCheckedChange={() => toggle(looseShapeIds)} />
            <PenLine className="h-3.5 w-3.5 shrink-0" />
            Formas soltas
          </label>
        )}
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
