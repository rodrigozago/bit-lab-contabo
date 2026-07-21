import { useEffect, useRef, useState, type ComponentType } from "react";
import { GeoShapeGeoStyle, type Editor as TldrawEditor, type TLShapeId } from "@tldraw/tldraw";
import {
  MousePointer2,
  Hand,
  Pencil,
  Square,
  Circle,
  Eraser,
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
  type LucideProps,
} from "lucide-react";
import { cn } from "@/lib/utils.ts";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";

type ToolKey = "select" | "hand" | "draw" | "rectangle" | "ellipse" | "eraser";

interface ToolDef {
  key: ToolKey;
  label: string;
  icon: ComponentType<LucideProps>;
}

// Só o essencial pra desenhar/delimitar área de bordado (mesmo conjunto que a
// antiga toolbar horizontal do tldraw): seleção, mover, desenho livre, as 2
// formas mais úteis e borracha.
const TOOLS: ToolDef[] = [
  { key: "select", label: "Selecionar (V)", icon: MousePointer2 },
  { key: "hand", label: "Mover tela (H)", icon: Hand },
  { key: "draw", label: "Desenhar (D)", icon: Pencil },
  { key: "rectangle", label: "Retângulo (R)", icon: Square },
  { key: "ellipse", label: "Elipse (O)", icon: Circle },
  { key: "eraser", label: "Borracha (E)", icon: Eraser },
];

interface Props {
  editor: TldrawEditor;
  selectedShapeIds: TLShapeId[];
}

/**
 * Toolbar vertical estilo Photoshop, sobreposta à esquerda do canvas — o ÚNICO
 * lugar com ferramentas de manipulação do canvas (Fase 7 do doc de progresso):
 * em cima as ferramentas de desenho (dirigem setCurrentTool do tldraw; a
 * toolbar horizontal nativa fica desligada via components.Toolbar = null no
 * Editor), embaixo as ações de forma que antes viviam num painel da sidebar
 * direita (agrupar/girar/espelhar direto, alinhar/distribuir num menu
 * — 8 opções não cabem no trilho). O estado ativo é derivado do editor
 * (getCurrentToolId), então atalhos de teclado também refletem aqui.
 */
export function CanvasToolbar({ editor, selectedShapeIds }: Props) {
  const lastGeo = useRef<"rectangle" | "ellipse">("rectangle");
  const [active, setActive] = useState<ToolKey>("select");

  useEffect(() => {
    const update = () =>
      setActive((prev) => {
        const id = editor.getCurrentToolId();
        if (id === "geo") return lastGeo.current;
        if (id === "select" || id === "hand" || id === "draw" || id === "eraser") return id;
        return prev; // ferramentas fora do rail (ex.: laser) — mantém o último
      });
    update();
    const unlisten = editor.store.listen(update, { scope: "session" });
    return () => unlisten();
  }, [editor]);

  function selectTool(key: ToolKey) {
    if (key === "rectangle" || key === "ellipse") {
      lastGeo.current = key;
      editor.setStyleForNextShapes(GeoShapeGeoStyle, key);
      editor.setCurrentTool("geo");
    } else {
      editor.setCurrentTool(key);
    }
    setActive(key);
  }

  const count = selectedShapeIds.length;
  const canGroup = count >= 2;
  const canTransform = count >= 1;
  const canAlign = count >= 2;
  const canDistribute = count >= 3;
  const canUngroup =
    count >= 1 && selectedShapeIds.some((id) => editor.getShape(id)?.type === "group");

  interface ActionDef {
    label: string;
    icon: ComponentType<LucideProps>;
    enabled: boolean;
    run: () => void;
  }

  const shapeActions: ActionDef[] = [
    { label: "Agrupar", icon: Group, enabled: canGroup, run: () => editor.groupShapes(selectedShapeIds) },
    { label: "Desagrupar", icon: Ungroup, enabled: canUngroup, run: () => editor.ungroupShapes(selectedShapeIds) },
    { label: "Girar 90° anti-horário", icon: RotateCcw, enabled: canTransform, run: () => editor.rotateShapesBy(selectedShapeIds, -Math.PI / 2) },
    { label: "Girar 90° horário", icon: RotateCw, enabled: canTransform, run: () => editor.rotateShapesBy(selectedShapeIds, Math.PI / 2) },
    { label: "Espelhar horizontal", icon: FlipHorizontal, enabled: canTransform, run: () => editor.flipShapes(selectedShapeIds, "horizontal") },
    { label: "Espelhar vertical", icon: FlipVertical, enabled: canTransform, run: () => editor.flipShapes(selectedShapeIds, "vertical") },
  ];

  const alignActions: ActionDef[] = [
    { label: "Esquerda", icon: AlignStartVertical, enabled: canAlign, run: () => editor.alignShapes(selectedShapeIds, "left") },
    { label: "Centro horizontal", icon: AlignCenterVertical, enabled: canAlign, run: () => editor.alignShapes(selectedShapeIds, "center-horizontal") },
    { label: "Direita", icon: AlignEndVertical, enabled: canAlign, run: () => editor.alignShapes(selectedShapeIds, "right") },
    { label: "Topo", icon: AlignStartHorizontal, enabled: canAlign, run: () => editor.alignShapes(selectedShapeIds, "top") },
    { label: "Centro vertical", icon: AlignCenterHorizontal, enabled: canAlign, run: () => editor.alignShapes(selectedShapeIds, "center-vertical") },
    { label: "Base", icon: AlignEndHorizontal, enabled: canAlign, run: () => editor.alignShapes(selectedShapeIds, "bottom") },
  ];

  const distributeActions: ActionDef[] = [
    { label: "Distribuir horizontal", icon: AlignHorizontalDistributeCenter, enabled: canDistribute, run: () => editor.distributeShapes(selectedShapeIds, "horizontal") },
    { label: "Distribuir vertical", icon: AlignVerticalDistributeCenter, enabled: canDistribute, run: () => editor.distributeShapes(selectedShapeIds, "vertical") },
  ];

  return (
    <div className="absolute left-3 top-1/2 z-10 flex -translate-y-1/2 flex-col gap-1 rounded-xl border bg-card/95 p-1 shadow-lg backdrop-blur">
      {TOOLS.map((tool) => {
        const Icon = tool.icon;
        const isActive = active === tool.key;
        return (
          <button
            key={tool.key}
            type="button"
            title={tool.label}
            aria-label={tool.label}
            aria-pressed={isActive}
            onClick={() => selectTool(tool.key)}
            className={cn(
              "flex size-9 items-center justify-center rounded-lg transition-colors",
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            <Icon className="size-[18px]" />
          </button>
        );
      })}

      <div className="mx-1 my-0.5 border-t" />

      {shapeActions.map((action) => {
        const Icon = action.icon;
        return (
          <button
            key={action.label}
            type="button"
            title={action.label}
            aria-label={action.label}
            disabled={!action.enabled}
            onClick={action.run}
            className={cn(
              "flex size-9 items-center justify-center rounded-lg transition-colors",
              action.enabled
                ? "text-muted-foreground hover:bg-accent hover:text-foreground"
                : "cursor-default text-muted-foreground/35",
            )}
          >
            <Icon className="size-[18px]" />
          </button>
        );
      })}

      <div className="mx-1 my-0.5 border-t" />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            title="Alinhar e distribuir"
            aria-label="Alinhar e distribuir"
            className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground data-[state=open]:bg-accent data-[state=open]:text-foreground"
          >
            <AlignStartVertical className="size-[18px]" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="start" className="w-52">
          <DropdownMenuLabel className="text-xs">Alinhar (2+ formas)</DropdownMenuLabel>
          {alignActions.map((action) => {
            const Icon = action.icon;
            return (
              <DropdownMenuItem key={action.label} disabled={!action.enabled} onSelect={action.run}>
                <Icon className="size-4" /> {action.label}
              </DropdownMenuItem>
            );
          })}
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-xs">Distribuir (3+ formas)</DropdownMenuLabel>
          {distributeActions.map((action) => {
            const Icon = action.icon;
            return (
              <DropdownMenuItem key={action.label} disabled={!action.enabled} onSelect={action.run}>
                <Icon className="size-4" /> {action.label}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
