import { useState, useCallback, useRef, useEffect, useMemo, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import {
  Tldraw,
  AssetRecordType,
  createShapeId,
  type Editor as TldrawEditor,
  type TLComponents,
  type TLShape,
  type TLShapeId,
} from "@tldraw/tldraw";
import "@tldraw/tldraw/tldraw.css";
import type { ImperativePanelHandle } from "react-resizable-panels";
import { PanelRight, Eye } from "lucide-react";
import { HOOP_PX_PER_MM, type CanvasSize, type EmbroideryElement, type EmbroideryProject } from "@ponto-studio/shared";
import { useProjectStore, type SaveStatus } from "../store/projectStore.ts";
import { api } from "../api/client.ts";
import { rectToSvgPath, parseRectSvgPath } from "../utils/geometry.ts";
import { splitSvgByColor, splitSvgIntoRegions, recolorSvg } from "../utils/svgLayers.ts";
import { findShapeByElementId, setShapesHidden } from "../utils/canvasShapes.ts";
import { findLayerMetrics, suggestStitchParams } from "../utils/stitchHeuristics.ts";
import { PropertiesPanel } from "./PropertiesPanel.tsx";
import { PartsPanel } from "./PartsPanel.tsx";
import { CanvasToolbar } from "./CanvasToolbar.tsx";
import { ExportModal } from "./ExportModal.tsx";
import { ImportModal } from "./ImportModal.tsx";
import { TextToolModal } from "./TextToolModal.tsx";
import { useToast } from "./Toast.tsx";
import { HistoryModal } from "./HistoryModal.tsx";
import type { ImportConfirmPayload } from "./ImportModal.tsx";
import { AppSidebar } from "@/components/app-sidebar";
import { ModeToggle } from "@/components/mode-toggle";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar.tsx";
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

// ── UI do tldraw enxuta (EDIT-2 + Fase 7) ──────────────────────────────────────
// A toolbar horizontal nativa do tldraw fica desligada (Toolbar: null) — as
// ferramentas agora vivem no CanvasToolbar vertical (estilo Photoshop) sobreposto
// à esquerda do canvas, que dirige a mesma API do tldraw (setCurrentTool).
// Sem PageMenu: o projeto não tem conceito de múltiplas páginas (1 EmbroideryProject = 1 canvas).
// Fase 7: MenuPanel (hambúrguer do canto superior-esquerdo, com Edit/View/Export
// nativos), StylePanel, ActionsMenu e QuickActions também desligados — eram
// resíduo herdado (nunca foram nulados de propósito) e competiam visualmente
// com o CanvasToolbar/sidebars custom, além de expor ações duplicadas (export
// SVG/PNG nativo, agrupar nativo etc.) fora do fluxo do app.
// OnTheCanvas é criado por componente (useMemo no Editor) porque precisa do
// canvas.widthMm/heightMm do projeto pra desenhar o overlay do bastidor.
const baseTldrawComponents: Omit<TLComponents, "OnTheCanvas"> = {
  Toolbar: null,
  PageMenu: null,
  MenuPanel: null,
  StylePanel: null,
  ActionsMenu: null,
  QuickActions: null,
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
    toggleElementHidden,
    splitElement,
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
  // ── Preview de bordado no canvas (Fase 8.2) ──
  // Ligado, troca o `src` do asset de cada parte pelo SVG de PONTOS gerado
  // pelo motor real (/api/preview) — o SHAPE é o mesmo (id/meta/bounds/
  // rotação intactos), então mover/esticar/girar continuam funcionando e o
  // sync com o EmbroideryElement não muda em nada. Desligado, restaura o src
  // original (SVG chapado). `previewOriginalSrc` guarda o src real de cada
  // elemento trocado; `previewGeneration` invalida respostas de jobs que
  // chegarem depois de o usuário desligar/religar o preview no meio.
  const [stitchPreviewOn, setStitchPreviewOn] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const previewOriginalSrc = useRef<Map<string, string>>(new Map());
  const previewGeneration = useRef(0);
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
    // e mantém a lista bruta de shapes selecionados (pras ações do CanvasToolbar).
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
            // Salva o retângulo NÃO rotacionado (w/h do shape, centrado no
            // centro da AABB — que coincide com o centro do rect rotacionado)
            // + rotation à parte. Salvar a própria AABB inflava o bbox e o
            // export encolhia o desenho via contain-fit; a rotação é aplicada
            // pelo worker (ponto:rotation) ao redor desse mesmo centro.
            const props = shape.props as { w?: number; h?: number };
            let w = props.w, h = props.h;
            if (w == null || h == null) {
              const geo = editor.getShapeGeometry(shape).bounds;
              w = geo.w; h = geo.h;
            }
            const cx = bounds.x + bounds.w / 2;
            const cy = bounds.y + bounds.h / 2;
            updateElement(elementId, {
              svgPath: rectToSvgPath(cx - w / 2, cy - h / 2, w, h),
              rotation: shape.rotation,
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
              // siblings acabaram de ser posicionados exatamente em `bounds`
              // (updateShapes acima), então o rect não-rotacionado deles É o
              // próprio bounds; a rotação individual segue à parte.
              updateElement(siblingElementId, {
                svgPath: rectToSvgPath(bounds.x, bounds.y, bounds.w, bounds.h),
                rotation: s.rotation,
              });
            }
          }
        }
      },
      { scope: "document", source: "user" }
    );

    if (initialSvgLoaded.current || !localProject) return;

    // Recria no canvas TODAS as partes salvas (não só a primeira), cada uma na
    // POSIÇÃO/TAMANHO persistidos no svgPath (antes o load ignorava o svgPath
    // e jogava tudo no centro do viewport a 100×100 — as partes reabriam no
    // lugar errado). Recolore com el.color (a cor pode ter mudado depois da
    // importação e o svgContent guarda a cor antiga). Só partes com svgContent
    // (importadas/texto) viram shape de imagem; shapes desenhados à mão sem
    // svgContent seguem fora deste caminho, como antes.
    const savedElements = localProject.elements.filter((el) => el.svgContent);
    if (savedElements.length > 0) {
      // marca antes do async — StrictMode monta duas vezes e duplicaria os shapes
      initialSvgLoaded.current = true;
      const vp = editor.getViewportPageBounds();
      const rotatedAfter: Array<{ id: TLShapeId; rotation: number }> = [];

      const loadSavedElements = async () => {
        for (const el of savedElements) {
          const recolored = recolorSvg(el.svgContent!, el.color);
          const dataUrl = await svgToDataUrl(recolored);

          // Posição/tamanho reais do svgPath; fallback (legado sem svgPath
          // utilizável) = centro do viewport a 100×100.
          const rect = parseRectSvgPath(el.svgPath) ?? {
            x: vp.x + (vp.w - 100) / 2, y: vp.y + (vp.h - 100) / 2, w: 100, h: 100,
          };
          const hidden = !!el.hidden;
          const rotation = el.rotation ?? 0;

          const assetId = AssetRecordType.createId();
          editor.createAssets([{
            id: assetId, type: "image", typeName: "asset",
            props: { name: "bordado.svg", src: dataUrl, w: rect.w, h: rect.h, mimeType: "image/svg+xml", isAnimated: false },
            meta: {},
          }]);

          const shapeId = createShapeId();
          editor.createShape({
            id: shapeId,
            type: "image",
            // x/y = canto do retângulo NÃO-rotacionado (o svgPath é sempre o
            // rect não-rotacionado centrado no centro de rotação — ver o
            // listener de sync). A rotação em torno do CENTRO é aplicada depois
            // via rotateShapesBy, mesma semântica da rotação feita pelo usuário.
            x: rect.x, y: rect.y,
            opacity: hidden ? 0 : 1,
            isLocked: hidden,
            props: { assetId, w: rect.w, h: rect.h },
            meta: {
              layer: "embroidery", elementId: el.id,
              importGroupId: el.groupId ?? crypto.randomUUID(),
              importGroupName: el.groupName ?? "Bordado",
              ...(hidden ? { prevOpacity: 1 } : {}),
            },
          } as Parameters<typeof editor.createShape>[0]);

          if (rotation !== 0) rotatedAfter.push({ id: shapeId, rotation });
        }

        // Rotaciona as partes rotacionadas em torno do próprio centro (o
        // rotateShapesBy usa o centro do bounds = mesma âncora da rotação do
        // usuário), agora que já estão no lugar/tamanho certos.
        for (const { id, rotation } of rotatedAfter) {
          editor.rotateShapesBy([id], rotation);
        }
      };
      loadSavedElements().catch((err) => {
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

    // Liga todas as cores do bordado num grupo: redimensionar qualquer uma
    // delas redimensiona as outras junto (mantém alinhadas). A foto de
    // referência NÃO vira mais um shape no canvas (Fase 8.1 — nascia oculta e
    // só confundia; a imagem original continua disponível no modal de import
    // durante a análise, que é onde ela é útil). O checkbox "Foto de
    // referência" do PartsPanel some sozinho — depende de shapes com
    // meta.layer === "reference", que não são mais criados.
    const importGroupId = crypto.randomUUID();
    const existingGroupIds = new Set(
      tldrawEditor.getCurrentPageShapes().map((s) => s.meta?.["importGroupId"]).filter(Boolean)
    );
    const baseName = file.name.replace(/\.[^./]+$/, "").trim();
    const importGroupName = baseName || `Bordado ${existingGroupIds.size + 1}`;

    // ── Áreas do bordado, UMA POR COR ──
    // O SVG da análise é separado por cor: todas as regiões da mesma cor
    // (mesmo desconectadas) viram um único elemento/camada, com configuração
    // de ponto própria. Cada cor ganha um shape empilhado na mesma posição,
    // vinculado ao elemento via meta.elementId.
    const colorLayers = splitSvgByColor(result.svg);
    // fallback: SVG sem paths reconhecíveis → mantém o documento inteiro
    const layersToCreate = colorLayers.length > 0
      ? colorLayers
      : [{ color: "#7c5cbf", svgContent: result.svg }];

    // Heurística de parâmetros: converte as métricas da análise (px da imagem
    // analisada) pra mm reais no bastidor e sugere tipo/densidade/ângulo por
    // camada — em vez do default fixo pra tudo. `pxPerMm` usa a largura da
    // imagem analisada sobre a largura REAL do desenho no bastidor.
    const analyzeMetrics = result.metrics;
    const pxPerMm = analyzeMetrics
      ? analyzeMetrics.imageWidth / (canvasW / HOOP_PX_PER_MM)
      : 0;

    for (const [layerIndex, layer] of layersToCreate.entries()) {
      // SVG chapado serve de placeholder até o preview de pontos carregar
      const layerDataUrl = await svgToDataUrl(layer.svgContent);

      const layerMetrics = findLayerMetrics(analyzeMetrics, layer.color);
      const suggested = layerMetrics
        ? suggestStitchParams(layerMetrics, analyzeMetrics, pxPerMm, layerIndex)
        : undefined;

      const elementId = addElement(
        rectToSvgPath(imgX, imgY, canvasW, canvasH),
        layer.color,
        layer.svgContent,
        {
          groupId: importGroupId, groupName: importGroupName,
          ...(suggested ? { stitch: suggested, stitchSuggested: true } : {}),
        }
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

  // Alterna a visibilidade da parte: persiste em element.hidden (store) e
  // reflete no shape vinculado do canvas (opacity/lock).
  function handleToggleElementHidden(elementId: string) {
    const el = localProject.elements.find((e) => e.id === elementId);
    const nextHidden = !el?.hidden;
    toggleElementHidden(elementId);
    if (!tldrawEditor) return;
    const shape = findShapeByElementId(tldrawEditor, elementId);
    if (shape) setShapesHidden(tldrawEditor, [shape.id], nextHidden);
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
  /** Asset do shape de imagem vinculado a um elemento (null se não achou). */
  function getElementAsset(elementId: string) {
    if (!tldrawEditor) return null;
    const shape = findShapeByElementId(tldrawEditor, elementId);
    if (!shape) return null;
    const assetId = (shape.props as { assetId?: string }).assetId;
    if (!assetId) return null;
    const asset = tldrawEditor.getAsset(assetId as Parameters<typeof tldrawEditor.getAsset>[0]);
    return asset ? { assetId, asset } : null;
  }

  /** Troca o src de um asset preservando o resto das props (updateAssets NÃO
   * faz merge profundo — passar só { src } derrubaria w/h/mimeType). */
  function setAssetSrc(assetId: string, src: string) {
    if (!tldrawEditor) return;
    const current = tldrawEditor.getAsset(assetId as Parameters<typeof tldrawEditor.getAsset>[0]);
    if (!current) return;
    tldrawEditor.updateAssets([
      { id: assetId, type: "image", props: { ...current.props, src } },
    ] as Parameters<typeof tldrawEditor.updateAssets>[0]);
  }

  /** Pede o SVG de pontos de um elemento ao motor real e espera ficar pronto
   * (com prazo — sem worker rodando, o job ficaria na fila pra sempre). */
  async function fetchPreviewSvg(el: EmbroideryElement): Promise<string> {
    const { jobId } = await api.preview.create({ element: el, canvas: localProject.canvas });
    const deadline = Date.now() + 90_000;
    while (Date.now() < deadline) {
      const job = await api.preview.poll(jobId);
      if (job.status === "done") {
        if (!job.svg) throw new Error("Preview terminou sem SVG");
        return job.svg;
      }
      if (job.status === "error") throw new Error(job.errorMessage ?? "Falha ao gerar o preview");
      await new Promise((r) => setTimeout(r, 500));
    }
    throw new Error("Tempo esgotado gerando o preview — o worker está rodando?");
  }

  /** Gera e aplica o preview de pontos de UM elemento (asset src do shape). */
  async function applyPreviewToElement(el: EmbroideryElement, generation: number) {
    const info = getElementAsset(el.id);
    if (!info) return;
    const svg = await fetchPreviewSvg(el);
    if (generation !== previewGeneration.current) return; // preview desligado no meio
    const dataUrl = await svgToDataUrl(svg);
    if (generation !== previewGeneration.current) return;
    // guarda o src REAL só na primeira troca (refreshes subsequentes não
    // podem sobrescrever o original com um preview anterior)
    if (!previewOriginalSrc.current.has(el.id)) {
      previewOriginalSrc.current.set(el.id, (info.asset.props as { src: string }).src);
    }
    setAssetSrc(info.assetId, dataUrl);
  }

  async function toggleStitchPreview() {
    if (!tldrawEditor) return;

    if (stitchPreviewOn) {
      previewGeneration.current++;
      setStitchPreviewOn(false);
      setPreviewLoading(false);
      for (const [elementId, src] of previewOriginalSrc.current) {
        const info = getElementAsset(elementId);
        if (info) setAssetSrc(info.assetId, src);
      }
      previewOriginalSrc.current.clear();
      return;
    }

    // Só elementos com svgContent têm preview (a rota exige; formas simples
    // desenhadas à mão são shapes nativos do tldraw, sem asset pra trocar).
    const candidates = localProject.elements.filter((e) => e.svgContent);
    if (candidates.length === 0) {
      toast.info("Nenhuma parte com desenho importado pra pré-visualizar.");
      return;
    }

    setStitchPreviewOn(true);
    setPreviewLoading(true);
    const generation = ++previewGeneration.current;
    const results = await Promise.allSettled(
      candidates.map((el) => applyPreviewToElement(el, generation))
    );
    if (generation !== previewGeneration.current) return;
    setPreviewLoading(false);
    const failed = results.filter((r) => r.status === "rejected").length;
    if (failed > 0) {
      toast.error(
        `Preview de bordado falhou pra ${failed} parte${failed > 1 ? "s" : ""} — o worker está rodando?`
      );
    }
  }

  async function handlePropertiesChange(elementId: string, patch: Partial<EmbroideryElement>) {
    // editar o ponto manualmente substitui a sugestão da heurística
    if (patch.stitch) patch = { ...patch, stitchSuggested: false };
    updateElement(elementId, patch);
    if (!tldrawEditor) return;

    const el = localProject.elements.find((e) => e.id === elementId);
    if (!el?.svgContent) return;
    // `localProject` deste closure ainda não viu o updateElement — aplica o
    // patch em cima pra gerar preview/recolor com o estado novo.
    const merged = { ...el, ...patch } as EmbroideryElement;

    // Preview ligado: cor E tipo/densidade de ponto mudam o desenho dos
    // pontos — regenera o preview desta parte (e atualiza o src REAL salvo,
    // pro toggle off restaurar já com a cor nova).
    if (stitchPreviewOn && (patch.color || patch.stitch)) {
      try {
        if (patch.color) {
          const recolored = recolorSvg(merged.svgContent!, patch.color);
          previewOriginalSrc.current.set(elementId, await svgToDataUrl(recolored));
        }
        await applyPreviewToElement(merged, previewGeneration.current);
      } catch (err) {
        toast.error(
          `Erro ao atualizar o preview: ${err instanceof Error ? err.message : "erro desconhecido"}`
        );
      }
      return;
    }

    if (!patch.color) return;
    try {
      const recolored = recolorSvg(merged.svgContent!, patch.color);
      const dataUrl = await svgToDataUrl(recolored);
      const info = getElementAsset(elementId);
      if (!info) return;
      setAssetSrc(info.assetId, dataUrl);
    } catch (err) {
      // o dado já foi salvo (updateElement); só o redesenho no canvas falhou
      toast.error(
        `Erro ao atualizar a cor no canvas: ${err instanceof Error ? err.message : "erro desconhecido"}`
      );
    }
  }

  // ── Separação de regiões (Fase 5) ──
  // Nº de regiões desconectadas da parte selecionada — habilita o botão
  // "Separar regiões" do PropertiesPanel quando >= 2.
  const selectedRegionCount = useMemo(() => {
    if (!selectedElement?.svgContent) return 0;
    return splitSvgIntoRegions(selectedElement.svgContent).length;
  }, [selectedElement?.svgContent]);

  /**
   * Divide a parte selecionada nas suas regiões desconectadas: o store troca
   * o elemento por N clones (mesma cor/ponto, nomes "base 1..N", mesma
   * posição na ordem de costura) e o canvas troca o shape original por N
   * shapes idênticos em posição/tamanho/rotação — cada região continua
   * desenhando no mesmo lugar porque todos os SVGs compartilham o viewBox
   * original (coordenadas absolutas).
   */
  async function handleSplitElement(elementId: string) {
    if (!tldrawEditor) return;
    const el = localProject.elements.find((e) => e.id === elementId);
    if (!el?.svgContent) return;
    const regions = splitSvgIntoRegions(el.svgContent);
    if (regions.length < 2) return;

    const shape = findShapeByElementId(tldrawEditor, elementId);
    const newIds = splitElement(elementId, regions);
    if (newIds.length === 0) return;

    try {
      if (shape && shape.type === "image") {
        const { x, y, rotation } = shape;
        const shapeProps = shape.props as { w: number; h: number };
        const baseMeta = { ...shape.meta };
        for (const [i, regionSvg] of regions.entries()) {
          const dataUrl = await svgToDataUrl(recolorSvg(regionSvg, el.color));
          const assetId = AssetRecordType.createId();
          tldrawEditor.createAssets([{
            id: assetId, type: "image", typeName: "asset",
            props: { name: `regiao-${i + 1}.svg`, src: dataUrl, w: shapeProps.w, h: shapeProps.h, mimeType: "image/svg+xml", isAnimated: false },
            meta: {},
          }]);
          tldrawEditor.createShape({
            type: "image", x, y, rotation,
            props: { assetId, w: shapeProps.w, h: shapeProps.h },
            meta: { ...baseMeta, elementId: newIds[i] },
          } as Parameters<typeof tldrawEditor.createShape>[0]);
        }
        tldrawEditor.deleteShapes([shape.id]);
      }
      // o elemento antigo não existe mais — o src salvo pelo preview morre junto
      previewOriginalSrc.current.delete(elementId);
    } catch (err) {
      toast.error(
        `Erro ao separar as regiões no canvas: ${err instanceof Error ? err.message : "erro desconhecido"}`
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
      <AppSidebar
        projectContext={{ name: localProject.name, canvas: localProject.canvas }}
        projectActions={{
          onImportImage: () => setShowImport(true),
          onAddText: () => setShowTextTool(true),
          onExport: () => setShowExport(true),
          onHistory: () => setShowHistory(true),
          onDeleteProject: handleDeleteProject,
          deleting,
        }}
      />
      <SidebarInset className="overflow-hidden">
        {/* ── Topbar ── */}
        <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b">
          <div className="flex w-full min-w-0 items-center gap-1 px-4 py-3 lg:gap-2">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mx-2 data-[orientation=vertical]:h-4" />
            <span className="truncate text-sm font-semibold">{localProject.name}</span>
            <SaveStatusIndicator status={saveStatus} lastSavedAt={lastSavedAt} lastError={lastError} onRetry={retrySync} />
            {/* Ações (importar/exportar/histórico/deletar) migraram pras seções
                do painel direito — a topbar fica só com contexto + toggles. */}
            <div className="ml-auto flex items-center gap-2">
              <Button
                variant={stitchPreviewOn ? "secondary" : "ghost"}
                size="icon"
                className={stitchPreviewOn ? "size-7 text-primary" : "size-7"}
                onClick={() => void toggleStitchPreview()}
                title={stitchPreviewOn ? "Desligar preview do bordado" : "Ver preview do bordado (pontos reais)"}
                aria-pressed={stitchPreviewOn}
                disabled={previewLoading}
              >
                {previewLoading
                  ? <div className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  : <Eye />}
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
            {/* isolate: cria stacking context próprio pro tldraw, senão os z-index
                internos dele (até 1000) vazam pro contexto raiz e cobrem os
                portais do Radix (dropdown do usuário/logout, tooltip da sidebar). */}
            <div className="relative h-full isolate">
              <Tldraw onMount={handleMount} components={tldrawComponents} />
              {tldrawEditor && <CanvasToolbar editor={tldrawEditor} selectedShapeIds={selectedShapeIds} />}
            </div>
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel ref={rightPanelRef} defaultSize={24} minSize={16} maxSize={34} collapsible collapsedSize={4}>
            <div className="flex h-full w-full flex-col overflow-y-auto border-l bg-sidebar text-sidebar-foreground">
              {/* ── PARTES (motor unificado camadas+áreas) ── */}
              <PartsPanel
                elements={localProject.elements}
                selectedElementId={selectedElement?.id ?? null}
                editor={tldrawEditor}
                onSelect={handleSelectElement}
                onToggleHidden={handleToggleElementHidden}
                onMove={moveElement}
              />

              {/* ── PROPRIEDADES ── */}
              {selectedElement ? (
                <PropertiesPanel
                  element={selectedElement}
                  onChange={(patch) => { void handlePropertiesChange(selectedElement.id, patch); }}
                  onDelete={() => handleDeleteElement(selectedElement.id)}
                  regionCount={selectedRegionCount}
                  onSplit={() => { void handleSplitElement(selectedElement.id); }}
                />
              ) : (
                <div className="flex flex-col items-center justify-center gap-2 border-t p-4 text-center">
                  <span className="text-xl">👆</span>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Selecione uma parte pra configurar
                  </p>
                </div>
              )}

              {/* Arquivo/Editar migraram pra sidebar ESQUERDA (AppSidebar,
                  projectActions) e as ações de forma pro CanvasToolbar —
                  Fase 7: este painel é só Partes + Propriedades. */}
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
        {/* Trava a tela enquanto o preview de bordado gera no worker (job do
            Ink/Stitch, alguns segundos) — o overlay full-screen intercepta os
            cliques, então o usuário não dispara outras ações no meio. */}
        {previewLoading && (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-background/55">
            <div className="flex items-center gap-3 rounded-xl border bg-card px-5 py-4 text-sm font-semibold shadow-lg">
              <div className="h-5 w-5 animate-spin rounded-full border-[3px] border-border border-t-primary" />
              <span>Gerando preview do bordado…</span>
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
