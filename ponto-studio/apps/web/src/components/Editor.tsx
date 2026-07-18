import { useState, useCallback, useRef, useEffect, useMemo, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import {
  Tldraw,
  AssetRecordType,
  DefaultToolbar,
  SelectToolbarItem,
  HandToolbarItem,
  DrawToolbarItem,
  RectangleToolbarItem,
  EllipseToolbarItem,
  EraserToolbarItem,
  type Editor as TldrawEditor,
  type TLComponents,
  type TLShape,
  type TLShapeId,
} from "@tldraw/tldraw";
import "@tldraw/tldraw/tldraw.css";
import type { ImperativePanelHandle } from "react-resizable-panels";
import { ImageUp, Type as TypeIcon, Download, History as HistoryIcon, Trash2, PanelRight } from "lucide-react";
import { HOOP_PX_PER_MM, type CanvasSize, type EmbroideryElement, type EmbroideryProject } from "@ponto-studio/shared";
import { useProjectStore, type SaveStatus } from "../store/projectStore.ts";
import { api } from "../api/client.ts";
import { rectToSvgPath } from "../utils/geometry.ts";
import { splitSvgByColor, recolorSvg } from "../utils/svgLayers.ts";
import { PropertiesPanel } from "./PropertiesPanel.tsx";
import { ShapeActionsPanel } from "./ShapeActionsPanel.tsx";
import { LayersPanel } from "./LayersPanel.tsx";
import { ExportModal } from "./ExportModal.tsx";
import { ImportModal } from "./ImportModal.tsx";
import { TextToolModal } from "./TextToolModal.tsx";
import { useToast } from "./Toast.tsx";
import { HistoryModal } from "./HistoryModal.tsx";
import type { ImportConfirmPayload } from "./ImportModal.tsx";
import { cn } from "@/lib/utils.ts";
import { AppSidebar } from "@/components/app-sidebar";
import { ModeToggle } from "@/components/mode-toggle";
import { SidebarProvider, SidebarInset, SidebarTrigger, SidebarGroup, SidebarGroupLabel, SidebarGroupContent } from "@/components/ui/sidebar.tsx";
import { Separator } from "@/components/ui/separator.tsx";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable.tsx";
import { Button } from "@/components/ui/button.tsx";

// ── Área do bastidor ───────────────────────────────────────────────────────────
// Mapeamento fixo entre mm do bastidor e o page-space do tldraw: origem (0,0),
// escala HOOP_PX_PER_MM (compartilhada com o svgConverter da API — mesmo
// fator dos dois lados, senão redimensionar no editor não bate com o export).
function hoopPageBounds(canvas: CanvasSize) {
  return { x: 0, y: 0, w: canvas.widthMm * HOOP_PX_PER_MM, h: canvas.heightMm * HOOP_PX_PER_MM };
}

/**
 * Mostra os limites físicos do bastidor no canvas: a área fora dele fica
 * vermelha e esmaecida (truque de box-shadow com spread gigante — pinta tudo
 * ao redor do retângulo sem precisar de máscara SVG). Renderizado dentro do
 * mesmo layer pannable/zoomable dos shapes (OnTheCanvas), por isso as
 * coordenadas são direto em page-space, sem conversão manual de zoom/câmera.
 */
function HoopOverlay({ canvas }: { canvas: CanvasSize }) {
  const bounds = hoopPageBounds(canvas);
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: bounds.w,
        height: bounds.h,
        transform: `translate(${bounds.x}px, ${bounds.y}px)`,
        boxShadow: "0 0 0 9999px rgba(220,50,50,0.22)",
        border: "1.5px dashed rgba(220,50,50,0.5)",
        pointerEvents: "none",
      }}
    />
  );
}

// ── Indicador de autosave (modelo Canva: sem botão "Salvar", só status) ────────

/** "Salvo agora" / "Salvo há 23min" / "Salvo há 2h" / "Salvo há 2 dias" */
function formatSavedAgo(iso: string): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (diffSec < 60) return "Salvo agora";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `Salvo há ${diffMin}min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `Salvo há ${diffH}h`;
  const diffDays = Math.floor(diffH / 24);
  return `Salvo há ${diffDays} dia${diffDays > 1 ? "s" : ""}`;
}

function SaveStatusIndicator({
  status,
  lastSavedAt,
  lastError,
  onRetry,
}: {
  status: SaveStatus;
  lastSavedAt: string | null;
  lastError?: string | null;
  onRetry: () => void;
}) {
  // Reforça o texto periodicamente (ex.: "agora" → "1min" → "2min"...) mesmo
  // sem nenhuma edição nova acontecer.
  const [, forceTick] = useState(0);
  useEffect(() => {
    if (status !== "saved" || !lastSavedAt) return;
    const id = setInterval(() => forceTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, [status, lastSavedAt]);

  if (status === "idle") return null;
  if (status === "saving") return <span className="text-xs font-medium text-muted-foreground">Salvando…</span>;
  if (status === "error") {
    return (
      <button
        className="cursor-pointer border-none bg-transparent p-0 text-xs font-medium text-destructive underline"
        onClick={onRetry}
        title={`${lastError ? `${lastError} — ` : ""}Clique para tentar salvar de novo`}
      >
        ⚠ Erro ao salvar — tentar de novo
      </button>
    );
  }
  return (
    <span className="text-xs font-medium text-muted-foreground">
      {lastSavedAt ? formatSavedAgo(lastSavedAt) : "Salvo"}
    </span>
  );
}

// ── UI do tldraw enxuta (EDIT-2) ────────────────────────────────────────────────
// Só o essencial pra desenhar/editar áreas de bordado: seleção, mover (hand),
// desenho livre e as 2 formas mais úteis pra delimitar área (retângulo/elipse) +
// borracha. Sem texto/nota/frame/seta/formas decorativas — não fazem sentido
// como área de bordado. Sem asset (import de imagem) — o app tem fluxo próprio
// ("📷 Importar imagem"), o botão nativo do tldraw só confundiria.
function CustomToolbar() {
  return (
    <DefaultToolbar>
      <SelectToolbarItem />
      <HandToolbarItem />
      <DrawToolbarItem />
      <RectangleToolbarItem />
      <EllipseToolbarItem />
      <EraserToolbarItem />
    </DefaultToolbar>
  );
}

// Sem PageMenu: o projeto não tem conceito de múltiplas páginas (1 EmbroideryProject = 1 canvas).
// OnTheCanvas é criado por componente (useMemo no Editor) porque precisa do
// canvas.widthMm/heightMm do projeto pra desenhar o overlay do bastidor.
const baseTldrawComponents: Omit<TLComponents, "OnTheCanvas"> = {
  Toolbar: CustomToolbar,
  PageMenu: null,
};

// ── Main Editor Component ─────────────────────────────────────────────────────

interface Props {
  project: EmbroideryProject;
  onProjectChange: (p: EmbroideryProject) => Promise<void>;
  /** Navegação de volta feita pela sidebar (link "Meus projetos") — prop mantida opcional por compat. */
  onBackToHome?: () => void;
}

export function Editor({ project, onProjectChange }: Props) {
  const navigate = useNavigate();
  const toast = useToast();
  const [deleting, setDeleting] = useState(false);
  const [importing, setImporting] = useState(false);
  const {
    project: localProject,
    selectedElement,
    setSelectedElementId,
    addElement,
    updateElement,
    moveElement,
    removeElement,
    saveStatus,
    lastSavedAt,
    lastError,
    retrySync,
  } = useProjectStore(project, onProjectChange);

  const [showExport, setShowExport] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showTextTool, setShowTextTool] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [tldrawEditor, setTldrawEditor] = useState<TldrawEditor | null>(null);
  const [selectedShapeIds, setSelectedShapeIds] = useState<TLShapeId[]>([]);
  const initialSvgLoaded = useRef(false);
  // Evita reentrância no listener abaixo quando ELE MESMO chama updateShapes
  // pra propagar um resize entre os shapes de um mesmo grupo de import.
  const suppressGroupSync = useRef(false);
  const rightPanelRef = useRef<ImperativePanelHandle>(null);

  function toggleRightPanel() {
    const panel = rightPanelRef.current;
    if (!panel) return;
    if (panel.isCollapsed()) panel.expand();
    else panel.collapse();
  }

  const tldrawComponents: TLComponents = useMemo(
    () => ({
      ...baseTldrawComponents,
      OnTheCanvas: () => <HoopOverlay canvas={localProject.canvas} />,
    }),
    [localProject.canvas]
  );

  const handleMount = useCallback((editor: TldrawEditor) => {
    setTldrawEditor(editor);

    // Centraliza a câmera no bastidor sempre que o editor monta. O painel do
    // canvas vive num ResizablePanelGroup com autoSaveId — a largura salva no
    // localStorage é restaurada um instante depois do primeiro paint, o que
    // redimensiona o canvas DEPOIS do tldraw calcular a câmera inicial. Como a
    // câmera é fixa em page-space, esse resize tardio faz o desenho "pular de
    // lugar". Dois rAF garantem que o zoom rode após o layout assentar.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        editor.zoomToBounds(hoopPageBounds(localProject.canvas), { inset: 40 });
      });
    });

    // Shapes desenhados pelo usuário nascem na camada de bordado
    editor.getInitialMetaForShape = () => ({ layer: "embroidery" });

    // Seleção no canvas → seleciona o elemento de bordado vinculado (meta.elementId)
    // e mantém a lista bruta de shapes selecionados (pro ShapeActionsPanel).
    editor.store.listen(() => {
      const selectedIds = editor.getSelectedShapeIds();
      setSelectedShapeIds(selectedIds);
      if (selectedIds.length === 1 && selectedIds[0]) {
        const shape = editor.getShape(selectedIds[0]);
        setSelectedElementId((shape?.meta?.["elementId"] as string) ?? null);
      } else {
        setSelectedElementId(null);
      }
    });

    // Mudanças no documento → sincroniza áreas de bordado com o projeto
    editor.store.listen(
      (entry) => {
        for (const record of Object.values(entry.changes.removed)) {
          if (record.typeName === "shape") {
            const elementId = (record as TLShape).meta?.["elementId"] as string | undefined;
            if (elementId) removeElement(elementId);
          }
        }
        if (suppressGroupSync.current) return;

        for (const [from, to] of Object.values(entry.changes.updated)) {
          if (to.typeName !== "shape") continue;
          const shape = to as TLShape;
          const prevShape = from as TLShape;
          const elementId = shape.meta?.["elementId"] as string | undefined;
          const bounds = editor.getShapePageBounds(shape.id);
          if (elementId && bounds) {
            updateElement(elementId, {
              svgPath: rectToSvgPath(bounds.x, bounds.y, bounds.w, bounds.h),
            });
          }

          // Imagem importada (referência OU uma cor do bordado) redimensionada
          // → todo o import (referência + demais cores) resize/reposiciona
          // junto, senão as camadas empilhadas ficam desalinhadas entre si.
          const groupId = shape.meta?.["importGroupId"] as string | undefined;
          const prevProps = prevShape.props as { w?: number; h?: number };
          const props = shape.props as { w?: number; h?: number };
          const resized = prevProps.w !== props.w || prevProps.h !== props.h;
          if (!groupId || !resized || !bounds) continue;

          const siblings = editor
            .getCurrentPageShapes()
            .filter((s) => s.id !== shape.id && s.meta?.["importGroupId"] === groupId);
          if (siblings.length === 0) continue;

          suppressGroupSync.current = true;
          editor.updateShapes(
            siblings.map((s) => ({
              id: s.id, type: s.type,
              x: bounds.x, y: bounds.y,
              props: { ...s.props, w: bounds.w, h: bounds.h },
            }))
          );
          suppressGroupSync.current = false;

          for (const s of siblings) {
            const siblingElementId = s.meta?.["elementId"] as string | undefined;
            if (siblingElementId) {
              updateElement(siblingElementId, {
                svgPath: rectToSvgPath(bounds.x, bounds.y, bounds.w, bounds.h),
              });
            }
          }
        }
      },
      { scope: "document", source: "user" }
    );

    if (initialSvgLoaded.current || !localProject) return;

    const initialElement = localProject.elements.find(el => el.svgContent);
    if (initialElement?.svgContent) {
      // marca antes do async — StrictMode monta duas vezes e duplicaria o shape
      initialSvgLoaded.current = true;
      const loadInitialSvg = async () => {
        const svgBlob = new Blob([initialElement.svgContent!], { type: "image/svg+xml" });
        const svgDataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(svgBlob);
        });

        const svgAssetId = AssetRecordType.createId();
        editor.createAssets([{
          id: svgAssetId, type: "image", typeName: "asset",
          props: { name: "bordado.svg", src: svgDataUrl, w: 100, h: 100, mimeType: "image/svg+xml", isAnimated: false },
          meta: {},
        }]);

        const vp = editor.getViewportPageBounds();
        editor.createShape({
          type: "image",
          x: vp.x + (vp.w - 100) / 2, y: vp.y + (vp.h - 100) / 2,
          props: { assetId: svgAssetId, w: 100, h: 100 },
          // sem referência associada (elemento legado recarregado) — ainda
          // assim ganha um importGroupId próprio pra aparecer como grupo
          // no painel de camadas, só com a sub-camada "Bordado".
          meta: {
            layer: 'embroidery', elementId: initialElement.id,
            importGroupId: crypto.randomUUID(), importGroupName: "Bordado",
          },
        } as Parameters<typeof editor.createShape>[0]);
      };
      loadInitialSvg().catch((err) => {
        toast.error(
          `Erro ao carregar o desenho do projeto: ${err instanceof Error ? err.message : "erro desconhecido"}`
        );
      });
    }
  }, [setSelectedElementId, localProject, removeElement, updateElement, toast]);

  const handleImportConfirm = useCallback(async ({ file, result, previewDataUrl }: ImportConfirmPayload) => {
    if (!tldrawEditor) return;
    setShowImport(false);
    setImporting(true);

    try {
    const dims = await new Promise<{ w: number; h: number }>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = () => reject(new Error("A imagem de referência não pôde ser carregada"));
      img.src = previewDataUrl;
    });

    // Contain-fit dentro do retângulo do bastidor (não mais centralizado no
    // viewport arbitrário) — assim o que se vê alinhado ao overlay vermelho
    // já é, na prática, o que cabe (ou não) no bastidor de verdade.
    const hoop = hoopPageBounds(localProject.canvas);
    const scale = Math.min(hoop.w / dims.w, hoop.h / dims.h);
    const canvasW = Math.round(dims.w * scale);
    const canvasH = Math.round(dims.h * scale);
    const imgX = hoop.x + (hoop.w - canvasW) / 2;
    const imgY = hoop.y + (hoop.h - canvasH) / 2;

    // Liga referência + todas as cores do bordado num grupo: redimensionar
    // qualquer uma delas redimensiona as outras junto (mantém alinhadas), e
    // é a mesma chave que o painel de camadas (estilo Photoshop) usa pra
    // agrupar "Imagem de referência" + "Bordado" numa árvore por importação.
    const importGroupId = crypto.randomUUID();
    const existingGroupIds = new Set(
      tldrawEditor.getCurrentPageShapes().map((s) => s.meta?.["importGroupId"]).filter(Boolean)
    );
    const baseName = file.name.replace(/\.[^./]+$/, "").trim();
    const importGroupName = baseName || `Bordado ${existingGroupIds.size + 1}`;

    // ── Camada 1: imagem de referência ──
    const imageAssetId = AssetRecordType.createId();
    tldrawEditor.createAssets([{
      id: imageAssetId, type: "image", typeName: "asset",
      props: { name: file.name, src: previewDataUrl, w: dims.w, h: dims.h, mimeType: "image/png", isAnimated: false },
      meta: {},
    }]);
    // Referência nasce OCULTA por padrão (mesmo truque de isLocked+opacity:0
    // usado no toggle do LayersPanel — prevOpacity guarda o valor de volta
    // quando o usuário reativar a camada pelo painel) — o usuário normalmente
    // só quer ver o bordado, não a foto original por baixo.
    tldrawEditor.createShape({
      type: "image", x: imgX, y: imgY, opacity: 0, isLocked: true,
      props: { assetId: imageAssetId, w: canvasW, h: canvasH },
      meta: { layer: 'reference', importGroupId, importGroupName, prevOpacity: 0.4 },
    } as Parameters<typeof tldrawEditor.createShape>[0]);

    // ── Camada 2: áreas do bordado, UMA POR COR ──
    // O SVG da análise é separado por cor: todas as regiões da mesma cor
    // (mesmo desconectadas) viram um único elemento/camada, com configuração
    // de ponto própria. Cada cor ganha um shape empilhado na mesma posição,
    // vinculado ao elemento via meta.elementId.
    const colorLayers = splitSvgByColor(result.svg);
    // fallback: SVG sem paths reconhecíveis → mantém o documento inteiro
    const layersToCreate = colorLayers.length > 0
      ? colorLayers
      : [{ color: "#7c5cbf", svgContent: result.svg }];

    for (const layer of layersToCreate) {
      // SVG chapado serve de placeholder até o preview de pontos carregar
      const layerDataUrl = await svgToDataUrl(layer.svgContent);

      const elementId = addElement(
        rectToSvgPath(imgX, imgY, canvasW, canvasH),
        layer.color,
        layer.svgContent
      );

      const svgAssetId = AssetRecordType.createId();
      tldrawEditor.createAssets([{
        id: svgAssetId, type: "image", typeName: "asset",
        props: { name: `bordado-${layer.color}.svg`, src: layerDataUrl, w: canvasW, h: canvasH, mimeType: "image/svg+xml", isAnimated: false },
        meta: {},
      }]);
      tldrawEditor.createShape({
        type: "image", x: imgX, y: imgY,
        props: { assetId: svgAssetId, w: canvasW, h: canvasH },
        meta: { layer: 'embroidery', elementId, importGroupId, importGroupName },
      } as Parameters<typeof tldrawEditor.createShape>[0]);
    }

    // Enquadra o bastidor inteiro (não só a imagem) — o usuário precisa ver
    // o overlay vermelho pra entender se o desenho cabe ou não.
    tldrawEditor.zoomToBounds(
      { x: Math.min(hoop.x, imgX), y: Math.min(hoop.y, imgY), w: Math.max(hoop.w, canvasW), h: Math.max(hoop.h, canvasH) },
      { inset: 40 }
    );
    } catch (err) {
      toast.error(
        `Erro ao adicionar a imagem ao bordado: ${err instanceof Error ? err.message : "erro desconhecido"}`
      );
    } finally {
      setImporting(false);
    }
  }, [tldrawEditor, addElement, toast, localProject.canvas]);

  // Seleciona o elemento no painel e o shape correspondente no canvas
  function handleSelectElement(elementId: string) {
    setSelectedElementId(elementId);
    if (!tldrawEditor) return;
    const shape = tldrawEditor
      .getCurrentPageShapes()
      .find((s: TLShape) => s.meta?.["elementId"] === elementId);
    if (shape && !shape.isLocked) tldrawEditor.setSelectedShapes([shape.id]);
  }

  // Remove o elemento e o shape vinculado no canvas
  function handleDeleteElement(elementId: string) {
    removeElement(elementId);
    if (!tldrawEditor) return;
    const shape = tldrawEditor
      .getCurrentPageShapes()
      .find((s: TLShape) => s.meta?.["elementId"] === elementId);
    if (shape) tldrawEditor.deleteShapes([shape.id]);
  }

  // Muda propriedades do elemento (tipo/densidade/ângulo/cor). O shape no
  // canvas é uma imagem estática (asset gerado uma vez na importação) — se a
  // cor mudou, regenera o asset recolorido pra refletir no canvas também
  // (antes, mudar a cor só afetava o dado, não o que aparecia na tela).
  async function handlePropertiesChange(elementId: string, patch: Partial<EmbroideryElement>) {
    updateElement(elementId, patch);
    if (!patch.color || !tldrawEditor) return;

    try {
      const el = localProject.elements.find((e) => e.id === elementId);
      if (!el?.svgContent) return;

      const recolored = recolorSvg(el.svgContent, patch.color);
      const dataUrl = await svgToDataUrl(recolored);
      const shape = tldrawEditor
        .getCurrentPageShapes()
        .find((s: TLShape) => s.meta?.["elementId"] === elementId);
      if (!shape) return;

      const assetId = (shape.props as { assetId: string }).assetId;
      // updateAssets NÃO faz merge profundo de `props` — passar só { src }
      // sobrescreve o objeto inteiro e derruba w/h/mimeType (ValidationError:
      // props.w esperado number, veio undefined). Busca o asset atual e
      // mescla manualmente antes de atualizar.
      const currentAsset = tldrawEditor.getAsset(assetId as Parameters<typeof tldrawEditor.getAsset>[0]);
      if (!currentAsset) return;
      tldrawEditor.updateAssets([
        { id: assetId, type: "image", props: { ...currentAsset.props, src: dataUrl } },
      ] as Parameters<typeof tldrawEditor.updateAssets>[0]);
    } catch (err) {
      // o dado já foi salvo (updateElement); só o redesenho no canvas falhou
      toast.error(
        `Erro ao atualizar a cor no canvas: ${err instanceof Error ? err.message : "erro desconhecido"}`
      );
    }
  }

  async function handleDeleteProject() {
    if (!window.confirm(`Deletar projeto "${localProject.name}"? Esta ação não pode ser desfeita.`)) return;
    setDeleting(true);
    try {
      await api.projects.delete(project.id);
      navigate("/app");
    } catch (err) {
      toast.error(
        `Erro ao deletar projeto: ${err instanceof Error ? err.message : "erro desconhecido"}`
      );
      setDeleting(false);
    }
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "16rem",
          "--sidebar-width-icon": "3rem",
          "--header-height": "calc(var(--spacing) * 14)",
        } as CSSProperties
      }
      className="h-svh overflow-hidden"
    >
      <AppSidebar projectContext={{ name: localProject.name, canvas: localProject.canvas }} />
      <SidebarInset className="overflow-hidden">
        {/* ── Topbar ── */}
        <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b">
          <div className="flex w-full min-w-0 items-center gap-1 px-4 py-3 lg:gap-2">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mx-2 data-[orientation=vertical]:h-4" />
            <span className="truncate text-sm font-semibold">{localProject.name}</span>
            <SaveStatusIndicator status={saveStatus} lastSavedAt={lastSavedAt} lastError={lastError} onRetry={retrySync} />
            <div className="ml-auto flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowImport(true)}>
                <ImageUp /> Importar imagem
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowTextTool(true)}>
                <TypeIcon /> Adicionar texto
              </Button>
              <Button size="sm" onClick={() => setShowExport(true)}>
                <Download /> Exportar bordado
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setShowHistory(true)} title="Histórico do projeto">
                <HistoryIcon /> Histórico
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={handleDeleteProject}
                disabled={deleting}
                title="Deletar projeto"
              >
                <Trash2 /> Deletar
              </Button>
              <Button variant="ghost" size="icon" className="size-7" onClick={toggleRightPanel} title="Mostrar/ocultar painel direito">
                <PanelRight />
              </Button>
              <ModeToggle variant="ghost" />
            </div>
          </div>
        </header>

        {/* ── Main layout: canvas | handle | painel de ferramentas ── */}
        <ResizablePanelGroup direction="horizontal" autoSaveId="ponto-studio-editor-canvas-layout" className="min-h-0 flex-1">
          <ResizablePanel defaultSize={76} minSize={40}>
            <div className="relative h-full">
              <Tldraw onMount={handleMount} components={tldrawComponents} />
            </div>
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel ref={rightPanelRef} defaultSize={24} minSize={16} maxSize={34} collapsible collapsedSize={4}>
            <div className="flex h-full w-full flex-col overflow-y-auto border-l bg-sidebar text-sidebar-foreground">
                <LayersPanel editor={tldrawEditor} />
                <ShapeActionsPanel editor={tldrawEditor} selectedShapeIds={selectedShapeIds} />

                {selectedElement ? (
                  <PropertiesPanel
                    element={selectedElement}
                    onChange={(patch) => { void handlePropertiesChange(selectedElement.id, patch); }}
                    onDelete={() => handleDeleteElement(selectedElement.id)}
                  />
                ) : (
                  <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
                    <span className="text-3xl">👆</span>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      Selecione uma área no canvas para configurar o bordado
                    </p>
                  </div>
                )}

                <SidebarGroup className="border-t">
                  <SidebarGroupLabel>Áreas ({localProject.elements.length})</SidebarGroupLabel>
                  <SidebarGroupContent className="flex max-h-52 flex-col overflow-y-auto">
                    {localProject.elements.length === 0 && (
                      <p className="px-2 py-1.5 text-xs text-muted-foreground">
                        Importe uma imagem e analise com IA — a área do bordado é criada automaticamente.
                      </p>
                    )}
                    {localProject.elements.length > 1 && (
                      <p className="px-2 py-1.5 text-xs text-muted-foreground">
                        Ordem de costura na máquina — use ▲/▼ pra reordenar.
                      </p>
                    )}
                    {localProject.elements.map((el, idx) => (
                      <div
                        key={el.id}
                        className={cn(
                          "flex items-center gap-1 border-b py-1 pr-2",
                          el.id === selectedElement?.id && "bg-accent"
                        )}
                      >
                        <button
                          className="flex min-w-0 flex-1 items-center gap-2 py-1 pl-2 text-left"
                          onClick={() => handleSelectElement(el.id)}
                        >
                          <span className="w-5 shrink-0 text-xs font-bold text-muted-foreground">{idx + 1}º</span>
                          <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: el.color }} />
                          <span className="truncate text-xs capitalize">
                            {el.stitch.type} — {el.color}
                          </span>
                        </button>
                        <span className="flex shrink-0 flex-col">
                          <button
                            className={cn(
                              "px-1.5 text-[9px] leading-tight text-muted-foreground",
                              idx === 0 && "opacity-25"
                            )}
                            disabled={idx === 0}
                            title="Costurar antes"
                            onClick={() => moveElement(el.id, "up")}
                          >
                            ▲
                          </button>
                          <button
                            className={cn(
                              "px-1.5 text-[9px] leading-tight text-muted-foreground",
                              idx === localProject.elements.length - 1 && "opacity-25"
                            )}
                            disabled={idx === localProject.elements.length - 1}
                            title="Costurar depois"
                            onClick={() => moveElement(el.id, "down")}
                          >
                            ▼
                          </button>
                        </span>
                      </div>
                    ))}
                  </SidebarGroupContent>
                </SidebarGroup>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>

        {showExport && (
          <ExportModal projectId={localProject.id} canvas={localProject.canvas} onClose={() => setShowExport(false)} />
        )}
        {showImport && (
          <ImportModal onClose={() => setShowImport(false)} onConfirm={handleImportConfirm} />
        )}
        {showTextTool && (
          <TextToolModal
            onClose={() => setShowTextTool(false)}
            onConfirm={(payload) => {
              setShowTextTool(false);
              void handleImportConfirm(payload);
            }}
          />
        )}
        {showHistory && (
          <HistoryModal
            projectId={localProject.id}
            onClose={() => setShowHistory(false)}
            onRestored={() => navigate(0)}
          />
        )}
        {importing && (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-background/55">
            <div className="flex items-center gap-3 rounded-xl border bg-card px-5 py-4 text-sm font-semibold shadow-lg">
              <div className="h-5 w-5 animate-spin rounded-full border-[3px] border-border border-t-primary" />
              <span>Adicionando ao bordado…</span>
            </div>
          </div>
        )}
      </SidebarInset>
    </SidebarProvider>
  );
}

/** Serializa uma string SVG em data URL (base64) para usar como asset do tldraw. */
function svgToDataUrl(svg: string): Promise<string> {
  const blob = new Blob([svg], { type: "image/svg+xml" });
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
