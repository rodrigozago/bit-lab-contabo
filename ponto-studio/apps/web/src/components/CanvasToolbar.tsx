import { useEffect, useRef, useState, type ComponentType } from "react";
import { GeoShapeGeoStyle, type Editor as TldrawEditor } from "@tldraw/tldraw";
import {
  MousePointer2,
  Hand,
  Pencil,
  Square,
  Circle,
  Eraser,
  type LucideProps,
} from "lucide-react";
import { cn } from "@/lib/utils.ts";

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
}

/**
 * Toolbar vertical estilo Photoshop, sobreposta à esquerda do canvas. Dirige a
 * API nativa do tldraw (setCurrentTool); a toolbar horizontal padrão do tldraw
 * fica desligada (components.Toolbar = null no Editor). Retângulo/elipse usam o
 * tool "geo" + o estilo geo correspondente. O estado ativo é derivado do editor
 * (getCurrentToolId), então atalhos de teclado também refletem aqui.
 */
export function CanvasToolbar({ editor }: Props) {
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
    </div>
  );
}
