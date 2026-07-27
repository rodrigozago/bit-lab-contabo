import type { DragEvent, KeyboardEvent, MouseEvent } from "react";
import { Trash2 } from "lucide-react";
import type { DesignTemplate } from "@ponto-studio/shared";
import { composeThumbnail } from "../utils/svgLayers.ts";
import { Button } from "@/components/ui/button.tsx";

/** MIME custom do drag-and-drop de matriz → canvas — evita colisão com o
 * drop de arquivo do SO (usado só no dropzone de importar imagem). */
export const TEMPLATE_DRAG_MIME = "application/x-ponto-template-id";

interface Props {
  templates: DesignTemplate[];
  loading: boolean;
  /** Clique no tile — fallback acessível sem precisar do gesto de arrastar. */
  onInsert: (template: DesignTemplate) => void;
  /** Só passado quando o usuário logado é admin — mostra o botão de remover. */
  onDelete?: (templateId: string) => void;
}

/**
 * Galeria de matrizes prontas (catálogo global) — grid de miniaturas dentro
 * da sidebar esquerda do editor, arrastáveis (ou clicáveis) pro canvas. Cada
 * miniatura reusa `composeThumbnail`, o mesmo mecanismo já usado pros cards
 * de projeto na Home (recolore + calcula bbox real a partir dos paths).
 */
export function TemplatesGallery({ templates, loading, onInsert, onDelete }: Props) {
  if (loading) {
    return <p className="px-2 py-1.5 text-xs text-muted-foreground">Carregando matrizes…</p>;
  }
  if (templates.length === 0) {
    return <p className="px-2 py-1.5 text-xs text-muted-foreground">Nenhuma matriz publicada ainda.</p>;
  }
  return (
    <div className="grid max-h-[22rem] grid-cols-2 gap-2 overflow-y-auto px-2 pb-1">
      {templates.map((template) => (
        <TemplateTile key={template.id} template={template} onInsert={onInsert} onDelete={onDelete} />
      ))}
    </div>
  );
}

function TemplateTile({
  template,
  onInsert,
  onDelete,
}: {
  template: DesignTemplate;
  onInsert: (template: DesignTemplate) => void;
  onDelete?: (templateId: string) => void;
}) {
  const thumbnail = composeThumbnail(template.elements);

  function handleDragStart(e: DragEvent<HTMLDivElement>) {
    e.dataTransfer.setData(TEMPLATE_DRAG_MIME, template.id);
    e.dataTransfer.effectAllowed = "copy";
  }

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onInsert(template);
    }
  }

  function handleDelete(e: MouseEvent) {
    e.stopPropagation();
    if (!window.confirm(`Remover "${template.name}" da biblioteca? Esta ação não pode ser desfeita.`)) return;
    onDelete?.(template.id);
  }

  return (
    <div
      role="button"
      tabIndex={0}
      draggable
      onDragStart={handleDragStart}
      onClick={() => onInsert(template)}
      onKeyDown={handleKeyDown}
      title={`Adicionar "${template.name}" ao bordado — clique ou arraste pro canvas`}
      className="group relative flex cursor-grab flex-col gap-1 rounded-md border bg-card p-1.5 text-left transition-colors hover:border-primary/50 active:cursor-grabbing"
    >
      <div className="flex h-16 items-center justify-center overflow-hidden rounded-sm bg-muted">
        {thumbnail ? (
          <div className="h-4/5 w-4/5" dangerouslySetInnerHTML={{ __html: thumbnail }} />
        ) : (
          <span className="text-lg opacity-40">🧵</span>
        )}
      </div>
      <span className="truncate text-[11px] font-medium">{template.name}</span>
      {onDelete && (
        <Button
          variant="secondary"
          size="icon"
          className="absolute right-1 top-1 h-5 w-5 opacity-0 shadow-sm group-hover:opacity-100"
          onClick={handleDelete}
          title="Remover da biblioteca"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}
