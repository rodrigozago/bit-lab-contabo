import type { Editor as TldrawEditor, TLShapeId } from "@tldraw/tldraw";
import {
  Group,
  Ungroup,
  RotateCcw,
  RotateCw,
  FlipHorizontal,
  FlipVertical,
  AlignStartVertical,
  AlignCenterVertical,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignCenterHorizontal,
  AlignEndHorizontal,
  AlignHorizontalDistributeCenter,
  AlignVerticalDistributeCenter,
} from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { SidebarGroup, SidebarGroupContent, SidebarGroupLabel } from "@/components/ui/sidebar.tsx";

interface Props {
  editor: TldrawEditor | null;
  selectedShapeIds: TLShapeId[];
}

/**
 * Ferramentas de manipulação (grupo/rotacionar/espelhar/alinhar/distribuir) —
 * chamam a API do tldraw direto (editor.groupShapes/rotateShapesBy/etc já
 * existem prontas). Divididas em três seções da sidebar (FERRAMENTAS / ALINHAR /
 * DISTRIBUIR) pra ficarem descobríveis sem depender do menu de contexto do tldraw.
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
    <>
      {/* ── FERRAMENTAS ── */}
      <SidebarGroup>
        <SidebarGroupLabel>Ferramentas</SidebarGroupLabel>
        <SidebarGroupContent className="grid grid-cols-2 gap-1.5">
          <Button variant="outline" size="sm" disabled={!canGroup} onClick={() => run((e) => e.groupShapes(selectedShapeIds))}>
            <Group /> Agrupar
          </Button>
          <Button variant="outline" size="sm" disabled={!canUngroup} onClick={() => run((e) => e.ungroupShapes(selectedShapeIds))}>
            <Ungroup /> Desagrupar
          </Button>
          <Button variant="outline" size="sm" disabled={!canTransform} onClick={() => run((e) => e.rotateShapesBy(selectedShapeIds, -Math.PI / 2))}>
            <RotateCcw /> Girar
          </Button>
          <Button variant="outline" size="sm" disabled={!canTransform} onClick={() => run((e) => e.rotateShapesBy(selectedShapeIds, Math.PI / 2))}>
            <RotateCw /> Girar
          </Button>
          <Button variant="outline" size="sm" disabled={!canTransform} onClick={() => run((e) => e.flipShapes(selectedShapeIds, "horizontal"))}>
            <FlipHorizontal /> Espelhar H
          </Button>
          <Button variant="outline" size="sm" disabled={!canTransform} onClick={() => run((e) => e.flipShapes(selectedShapeIds, "vertical"))}>
            <FlipVertical /> Espelhar V
          </Button>
          {count === 0 && (
            <p className="col-span-2 text-[11px] text-muted-foreground">
              Selecione formas no canvas pra habilitar.
            </p>
          )}
        </SidebarGroupContent>
      </SidebarGroup>

      {/* ── ALINHAR ── */}
      <SidebarGroup>
        <SidebarGroupLabel>Alinhar</SidebarGroupLabel>
        <SidebarGroupContent className="grid grid-cols-2 gap-1.5">
          <Button variant="outline" size="sm" disabled={!canAlign} onClick={() => run((e) => e.alignShapes(selectedShapeIds, "left"))}>
            <AlignStartVertical /> Esquerda
          </Button>
          <Button variant="outline" size="sm" disabled={!canAlign} onClick={() => run((e) => e.alignShapes(selectedShapeIds, "center-horizontal"))}>
            <AlignCenterVertical /> Centro H
          </Button>
          <Button variant="outline" size="sm" disabled={!canAlign} onClick={() => run((e) => e.alignShapes(selectedShapeIds, "right"))}>
            <AlignEndVertical /> Direita
          </Button>
          <Button variant="outline" size="sm" disabled={!canAlign} onClick={() => run((e) => e.alignShapes(selectedShapeIds, "top"))}>
            <AlignStartHorizontal /> Topo
          </Button>
          <Button variant="outline" size="sm" disabled={!canAlign} onClick={() => run((e) => e.alignShapes(selectedShapeIds, "center-vertical"))}>
            <AlignCenterHorizontal /> Centro V
          </Button>
          <Button variant="outline" size="sm" disabled={!canAlign} onClick={() => run((e) => e.alignShapes(selectedShapeIds, "bottom"))}>
            <AlignEndHorizontal /> Base
          </Button>
        </SidebarGroupContent>
      </SidebarGroup>

      {/* ── DISTRIBUIR ── */}
      <SidebarGroup>
        <SidebarGroupLabel>Distribuir</SidebarGroupLabel>
        <SidebarGroupContent className="grid grid-cols-2 gap-1.5">
          <Button variant="outline" size="sm" disabled={!canDistribute} onClick={() => run((e) => e.distributeShapes(selectedShapeIds, "horizontal"))}>
            <AlignHorizontalDistributeCenter /> Horizontal
          </Button>
          <Button variant="outline" size="sm" disabled={!canDistribute} onClick={() => run((e) => e.distributeShapes(selectedShapeIds, "vertical"))}>
            <AlignVerticalDistributeCenter /> Vertical
          </Button>
        </SidebarGroupContent>
      </SidebarGroup>
    </>
  );
}
