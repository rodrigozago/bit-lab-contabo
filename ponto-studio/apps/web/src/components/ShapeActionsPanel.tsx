import { useState } from "react";
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
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip.tsx";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible.tsx";
import { SidebarGroup } from "@/components/ui/sidebar.tsx";
import { cn } from "@/lib/utils.ts";

interface Props {
  editor: TldrawEditor | null;
  selectedShapeIds: TLShapeId[];
}

/**
 * Ferramentas de manipulação (grupo/rotacionar/espelhar/alinhar/distribuir) —
 * chamam a API do tldraw direto (editor.groupShapes/rotateShapesBy/etc já
 * existem prontas). Cada seção é colapsível, com lista vertical de botões pra
 * ficar mais compacta quando o painel está recolhido.
 */
export function ShapeActionsPanel({ editor, selectedShapeIds }: Props) {
  const [expandedSections, setExpandedSections] = useState({
    tools: true,
    align: true,
    distribute: true,
  });

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

  function toggleSection(key: "tools" | "align" | "distribute") {
    setExpandedSections((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  }

  return (
    <>
      {/* ── FERRAMENTAS ── */}
      <SidebarGroup className="py-2">
        <Collapsible open={expandedSections.tools} onOpenChange={() => toggleSection("tools")}>
          <Tooltip>
            <TooltipTrigger asChild>
              <CollapsibleTrigger className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-xs font-semibold hover:bg-sidebar-accent">
                <ChevronRight className={cn("size-3.5 shrink-0 transition-transform", expandedSections.tools && "rotate-90")} />
                <span>Ferramentas</span>
              </CollapsibleTrigger>
            </TooltipTrigger>
            <TooltipContent side="right" className="text-xs">Agrupar, girar, espelhar</TooltipContent>
          </Tooltip>
          <CollapsibleContent className="mt-1 flex flex-col gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={!canGroup}
              onClick={() => run((e) => e.groupShapes(selectedShapeIds))}
              className="justify-start"
            >
              <Group className="size-4" /> Agrupar
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!canUngroup}
              onClick={() => run((e) => e.ungroupShapes(selectedShapeIds))}
              className="justify-start"
            >
              <Ungroup className="size-4" /> Desagrupar
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!canTransform}
              onClick={() => run((e) => e.rotateShapesBy(selectedShapeIds, -Math.PI / 2))}
              className="justify-start"
            >
              <RotateCcw className="size-4" /> Girar
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!canTransform}
              onClick={() => run((e) => e.rotateShapesBy(selectedShapeIds, Math.PI / 2))}
              className="justify-start"
            >
              <RotateCw className="size-4" /> Girar
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!canTransform}
              onClick={() => run((e) => e.flipShapes(selectedShapeIds, "horizontal"))}
              className="justify-start"
            >
              <FlipHorizontal className="size-4" /> Espelhar H
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!canTransform}
              onClick={() => run((e) => e.flipShapes(selectedShapeIds, "vertical"))}
              className="justify-start"
            >
              <FlipVertical className="size-4" /> Espelhar V
            </Button>
            {count === 0 && (
              <p className="text-[11px] text-muted-foreground">
                Selecione formas no canvas pra habilitar.
              </p>
            )}
          </CollapsibleContent>
        </Collapsible>
      </SidebarGroup>

      {/* ── ALINHAR ── */}
      <SidebarGroup className="py-2">
        <Collapsible open={expandedSections.align} onOpenChange={() => toggleSection("align")}>
          <Tooltip>
            <TooltipTrigger asChild>
              <CollapsibleTrigger className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-xs font-semibold hover:bg-sidebar-accent">
                <ChevronRight className={cn("size-3.5 shrink-0 transition-transform", expandedSections.align && "rotate-90")} />
                <span>Alinhar</span>
              </CollapsibleTrigger>
            </TooltipTrigger>
            <TooltipContent side="right" className="text-xs">Esquerda, centro, direita...</TooltipContent>
          </Tooltip>
          <CollapsibleContent className="mt-1 flex flex-col gap-1">
            <Button variant="outline" size="sm" disabled={!canAlign} onClick={() => run((e) => e.alignShapes(selectedShapeIds, "left"))} className="justify-start">
              <AlignStartVertical className="size-4" /> Esquerda
            </Button>
            <Button variant="outline" size="sm" disabled={!canAlign} onClick={() => run((e) => e.alignShapes(selectedShapeIds, "center-horizontal"))} className="justify-start">
              <AlignCenterVertical className="size-4" /> Centro H
            </Button>
            <Button variant="outline" size="sm" disabled={!canAlign} onClick={() => run((e) => e.alignShapes(selectedShapeIds, "right"))} className="justify-start">
              <AlignEndVertical className="size-4" /> Direita
            </Button>
            <Button variant="outline" size="sm" disabled={!canAlign} onClick={() => run((e) => e.alignShapes(selectedShapeIds, "top"))} className="justify-start">
              <AlignStartHorizontal className="size-4" /> Topo
            </Button>
            <Button variant="outline" size="sm" disabled={!canAlign} onClick={() => run((e) => e.alignShapes(selectedShapeIds, "center-vertical"))} className="justify-start">
              <AlignCenterHorizontal className="size-4" /> Centro V
            </Button>
            <Button variant="outline" size="sm" disabled={!canAlign} onClick={() => run((e) => e.alignShapes(selectedShapeIds, "bottom"))} className="justify-start">
              <AlignEndHorizontal className="size-4" /> Base
            </Button>
          </CollapsibleContent>
        </Collapsible>
      </SidebarGroup>

      {/* ── DISTRIBUIR ── */}
      <SidebarGroup className="py-2">
        <Collapsible open={expandedSections.distribute} onOpenChange={() => toggleSection("distribute")}>
          <Tooltip>
            <TooltipTrigger asChild>
              <CollapsibleTrigger className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-xs font-semibold hover:bg-sidebar-accent">
                <ChevronRight className={cn("size-3.5 shrink-0 transition-transform", expandedSections.distribute && "rotate-90")} />
                <span>Distribuir</span>
              </CollapsibleTrigger>
            </TooltipTrigger>
            <TooltipContent side="right" className="text-xs">Espaçamento horizontal, vertical</TooltipContent>
          </Tooltip>
          <CollapsibleContent className="mt-1 flex flex-col gap-1">
            <Button variant="outline" size="sm" disabled={!canDistribute} onClick={() => run((e) => e.distributeShapes(selectedShapeIds, "horizontal"))} className="justify-start">
              <AlignHorizontalDistributeCenter className="size-4" /> Horizontal
            </Button>
            <Button variant="outline" size="sm" disabled={!canDistribute} onClick={() => run((e) => e.distributeShapes(selectedShapeIds, "vertical"))} className="justify-start">
              <AlignVerticalDistributeCenter className="size-4" /> Vertical
            </Button>
          </CollapsibleContent>
        </Collapsible>
      </SidebarGroup>
    </>
  );
}
