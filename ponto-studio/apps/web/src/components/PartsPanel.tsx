import { useEffect, useMemo, useState } from "react";
import { Eye, EyeOff, Image as ImageIcon, PenLine } from "lucide-react";
import type { Editor as TldrawEditor, TLShapeId } from "@tldraw/tldraw";
import type { EmbroideryElement, StitchType } from "@ponto-studio/shared";
import { cn } from "@/lib/utils.ts";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import { SidebarGroup, SidebarGroupContent, SidebarGroupLabel } from "@/components/ui/sidebar.tsx";
import { setShapesHidden, isHidden } from "@/utils/canvasShapes.ts";

const STITCH_LABEL: Record<StitchType, string> = {
  tatami: "Tatami",
  contour: "Contorno",
  meander: "Meandro",
  circular: "Circular",
  // "satin" é alias legado — mecanicamente sempre foi contour_fill, nunca
  // cetim de verdade (ver StitchParams em packages/shared). Mostra igual.
  satin: "Contorno",
  running: "Corrido",
};

function partLabel(el: EmbroideryElement): string {
  if (el.name) return el.name;
  return `${STITCH_LABEL[el.stitch.type]} — ${el.color}`;
}

interface Props {
  elements: EmbroideryElement[];
  selectedElementId: string | null;
  editor: TldrawEditor | null;
  onSelect: (id: string) => void;
  onToggleHidden: (id: string) => void;
  onMove: (id: string, direction: "up" | "down") => void;
}

/**
 * Painel unificado "Partes do bordado" — funde o antigo painel de Camadas com a
 * lista de Áreas. A lista é dirigida pelo modelo salvo (projectStore.elements):
 * a posição = ordem de costura na máquina, o olho = element.hidden (persistido).
 * Foto de referência e formas soltas continuam sendo shapes só-do-tldraw,
 * expostos como toggles auxiliares no fim (visibilidade não persistida).
 */
export function PartsPanel({
  elements,
  selectedElementId,
  editor,
  onSelect,
  onToggleHidden,
  onMove,
}: Props) {
  // Só os toggles auxiliares (referência/formas soltas) dependem do tldraw; a
  // lista de partes re-renderiza sozinha (vem do store via props).
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!editor) return;
    const unlisten = editor.store.listen(() => setTick((t) => t + 1), { scope: "document" });
    return () => unlisten();
  }, [editor]);

  const { referenceIds, looseIds } = useMemo(() => {
    if (!editor) return { referenceIds: [] as TLShapeId[], looseIds: [] as TLShapeId[] };
    const referenceIds: TLShapeId[] = [];
    const looseIds: TLShapeId[] = [];
    for (const s of editor.getCurrentPageShapes()) {
      const layer = s.meta?.["layer"];
      if (layer === "reference") referenceIds.push(s.id);
      else if (layer === "embroidery" && !s.meta?.["elementId"]) looseIds.push(s.id);
    }
    return { referenceIds, looseIds };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, tick]);

  function toggleAux(ids: TLShapeId[]) {
    if (!editor || ids.length === 0) return;
    setShapesHidden(editor, ids, !isHidden(editor, ids));
  }

  const total = elements.length;

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Partes ({total})</SidebarGroupLabel>
      <SidebarGroupContent className="flex max-h-[22rem] flex-col gap-0.5 overflow-y-auto">
        {total === 0 && referenceIds.length === 0 && looseIds.length === 0 && (
          <p className="px-2 py-1.5 text-xs text-muted-foreground">
            Importe uma imagem e analise com IA — cada cor vira uma parte do bordado.
          </p>
        )}

        {total > 1 && (
          <p className="px-2 pb-1 text-[11px] text-muted-foreground">
            Ordem de costura na máquina — use ▲/▼ pra reordenar.
          </p>
        )}

        {elements.map((el, idx) => {
          const isSelected = el.id === selectedElementId;
          const hidden = !!el.hidden;
          return (
            <div
              key={el.id}
              className={cn(
                "flex items-center gap-1 rounded-md py-1 pr-1",
                isSelected && "bg-sidebar-accent",
              )}
            >
              <span className="w-5 shrink-0 text-center text-[10px] font-bold text-muted-foreground">
                {idx + 1}º
              </span>
              <button
                type="button"
                className="shrink-0 rounded p-1 text-muted-foreground hover:text-foreground"
                title={hidden ? "Mostrar parte" : "Ocultar parte"}
                aria-label={hidden ? "Mostrar parte" : "Ocultar parte"}
                onClick={() => onToggleHidden(el.id)}
              >
                {hidden ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
              </button>
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center gap-2 py-1 text-left"
                onClick={() => onSelect(el.id)}
              >
                <span
                  className="size-3 shrink-0 rounded-full border border-border"
                  style={{ background: el.color }}
                />
                <span className={cn("truncate text-xs", hidden && "text-muted-foreground line-through")}>
                  {partLabel(el)}
                </span>
              </button>
              <span className="flex shrink-0 flex-col">
                <button
                  type="button"
                  className={cn(
                    "px-1.5 text-[9px] leading-tight text-muted-foreground hover:text-foreground",
                    idx === 0 && "pointer-events-none opacity-25",
                  )}
                  disabled={idx === 0}
                  title="Costurar antes"
                  onClick={() => onMove(el.id, "up")}
                >
                  ▲
                </button>
                <button
                  type="button"
                  className={cn(
                    "px-1.5 text-[9px] leading-tight text-muted-foreground hover:text-foreground",
                    idx === total - 1 && "pointer-events-none opacity-25",
                  )}
                  disabled={idx === total - 1}
                  title="Costurar depois"
                  onClick={() => onMove(el.id, "down")}
                >
                  ▼
                </button>
              </span>
            </div>
          );
        })}

        {editor && (referenceIds.length > 0 || looseIds.length > 0) && (
          <div className="mt-1 flex flex-col gap-0.5 border-t pt-1.5">
            {referenceIds.length > 0 && (
              <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-xs">
                <Checkbox
                  checked={!isHidden(editor, referenceIds)}
                  onCheckedChange={() => toggleAux(referenceIds)}
                />
                <ImageIcon className="size-3.5 shrink-0" />
                Foto de referência
              </label>
            )}
            {looseIds.length > 0 && (
              <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-xs">
                <Checkbox
                  checked={!isHidden(editor, looseIds)}
                  onCheckedChange={() => toggleAux(looseIds)}
                />
                <PenLine className="size-3.5 shrink-0" />
                Formas soltas
              </label>
            )}
          </div>
        )}
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
