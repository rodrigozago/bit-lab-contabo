import { useState, useCallback, useRef, useEffect } from "react";
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
} from "@tldraw/tldraw";
import "@tldraw/tldraw/tldraw.css";
import type { EmbroideryElement, EmbroideryProject } from "@ponto-studio/shared";
import { useProjectStore, type SaveStatus } from "../store/projectStore.ts";
import { api } from "../api/client.ts";
import { rectToSvgPath } from "../utils/geometry.ts";
import { splitSvgByColor, recolorSvg } from "../utils/svgLayers.ts";
import { PropertiesPanel } from "./PropertiesPanel.tsx";
import { ExportModal } from "./ExportModal.tsx";
import { ImportModal } from "./ImportModal.tsx";
import type { ImportConfirmPayload } from "./ImportModal.tsx";

// ── Layer System ──────────────────────────────────────────────────────────────

interface LayerState {
  reference: boolean;
  embroidery: boolean;
}

function LayersPanel({ layers, onChange }: { layers: LayerState; onChange: (l: LayerState) => void }) {
  const handleToggle = (layer: keyof LayerState) => {
    onChange({ ...layers, [layer]: !layers[layer] });
  };
  return (
    <div style={layerPanelStyles.root}>
      <div style={layerPanelStyles.header}>
        <span style={layerPanelStyles.title}>Camadas</span>
      </div>
      <div style={layerPanelStyles.list}>
        <label style={layerPanelStyles.item}>
          <input type="checkbox" checked={layers.reference} onChange={() => handleToggle("reference")} />
          <span style={layerPanelStyles.label}>🖼️ Imagem de Referência</span>
        </label>
        <label style={layerPanelStyles.item}>
          <input type="checkbox" checked={layers.embroidery} onChange={() => handleToggle("embroidery")} />
          <span style={layerPanelStyles.label}>🪡 Bordado</span>
        </label>
      </div>
    </div>
  );
}

const layerPanelStyles: Record<string, React.CSSProperties> = {
  root: { borderTop: "1px solid #e2e0db" },
  header: { padding: "12px 16px", borderBottom: "1px solid #e2e0db" },
  title: {
    fontSize: 12, fontWeight: 700, textTransform: "uppercase",
    letterSpacing: "0.08em", color: "#6b6b6b",
  },
  list: { display: "flex", flexDirection: "column", padding: "8px 0" },
  item: {
    display: "flex", alignItems: "center", gap: 8, padding: "8px 16px",
    cursor: "pointer", fontSize: 13,
  },
  label: { color: "#1a1a1a", userSelect: "none" }
};


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
  onRetry,
}: {
  status: SaveStatus;
  lastSavedAt: string | null;
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
  if (status === "saving") return <span style={styles.saveStatus}>Salvando…</span>;
  if (status === "error") {
    return (
      <button
        style={{ ...styles.saveStatus, ...styles.saveStatusError }}
        onClick={onRetry}
        title="Clique para tentar salvar de novo"
      >
        ⚠ Erro ao salvar — tentar de novo
      </button>
    );
  }
  return <span style={styles.saveStatus}>{lastSavedAt ? formatSavedAgo(lastSavedAt) : "Salvo"}</span>;
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
const tldrawComponents: TLComponents = {
  Toolbar: CustomToolbar,
  PageMenu: null,
};

// ── Main Editor Component ─────────────────────────────────────────────────────

interface Props {
  project: EmbroideryProject;
  onProjectChange: (p: EmbroideryProject) => Promise<void>;
  onBackToHome: () => void;
}

export function Editor({ project, onProjectChange, onBackToHome }: Props) {
  const navigate = useNavigate();
  const [deleting, setDeleting] = useState(false);
  const {
    project: localProject,
    selectedElement,
    setSelectedElementId,
    addElement,
    updateElement,
    removeElement,
    saveStatus,
    lastSavedAt,
    retrySync,
  } = useProjectStore(project, onProjectChange);

  const [showExport, setShowExport] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [tldrawEditor, setTldrawEditor] = useState<TldrawEditor | null>(null);
  const [layers, setLayers] = useState<LayerState>({ reference: true, embroidery: true });
  const initialSvgLoaded = useRef(false);

  const handleMount = useCallback((editor: TldrawEditor) => {
    setTldrawEditor(editor);

    // Shapes desenhados pelo usuário nascem na camada de bordado
    editor.getInitialMetaForShape = () => ({ layer: "embroidery" });

    // Seleção no canvas → seleciona o elemento de bordado vinculado (meta.elementId)
    editor.store.listen(() => {
      const selectedIds = editor.getSelectedShapeIds();
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
        for (const [, to] of Object.values(entry.changes.updated)) {
          if (to.typeName !== "shape") continue;
          const shape = to as TLShape;
          const elementId = shape.meta?.["elementId"] as string | undefined;
          if (!elementId) continue;
          const bounds = editor.getShapePageBounds(shape.id);
          if (bounds) {
            updateElement(elementId, {
              svgPath: rectToSvgPath(bounds.x, bounds.y, bounds.w, bounds.h),
            });
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
          meta: { layer: 'embroidery', elementId: initialElement.id },
        } as Parameters<typeof editor.createShape>[0]);
      };
      loadInitialSvg();
    }
  }, [setSelectedElementId, localProject, removeElement, updateElement]);

  // Alterna visibilidade de uma camada: oculta (opacity 0) e bloqueia os shapes
  // para que não possam ser selecionados enquanto invisíveis.
  const handleLayersChange = useCallback((next: LayerState) => {
    if (tldrawEditor) {
      for (const key of Object.keys(next) as (keyof LayerState)[]) {
        if (next[key] === layers[key]) continue;
        const shapes = tldrawEditor
          .getCurrentPageShapes()
          .filter((s: TLShape) => s.meta?.["layer"] === key);
        if (shapes.length === 0) continue;

        if (next[key]) {
          tldrawEditor.updateShapes(shapes.map((s) => ({
            id: s.id, type: s.type,
            isLocked: false,
            opacity: (s.meta?.["prevOpacity"] as number | undefined) ?? 1,
          })));
        } else {
          tldrawEditor.setSelectedShapes(
            tldrawEditor.getSelectedShapeIds().filter((id) => !shapes.some((s) => s.id === id))
          );
          tldrawEditor.updateShapes(shapes.map((s) => ({
            id: s.id, type: s.type,
            isLocked: true,
            opacity: 0,
            meta: { ...s.meta, prevOpacity: s.opacity },
          })));
        }
      }
    }
    setLayers(next);
  }, [tldrawEditor, layers]);

  const handleImportConfirm = useCallback(async ({ file, result, previewDataUrl }: ImportConfirmPayload) => {
    if (!tldrawEditor) return;
    setShowImport(false);

    const dims = await new Promise<{ w: number; h: number }>((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.src = previewDataUrl;
    });

    const maxPx = 600;
    const scale = Math.min(1, maxPx / Math.max(dims.w, dims.h));
    const canvasW = Math.round(dims.w * scale);
    const canvasH = Math.round(dims.h * scale);

    const vp = tldrawEditor.getViewportPageBounds();
    const imgX = vp.x + (vp.w - canvasW) / 2;
    const imgY = vp.y + (vp.h - canvasH) / 2;

    // ── Camada 1: imagem de referência ──
    const imageAssetId = AssetRecordType.createId();
    tldrawEditor.createAssets([{
      id: imageAssetId, type: "image", typeName: "asset",
      props: { name: file.name, src: previewDataUrl, w: dims.w, h: dims.h, mimeType: "image/png", isAnimated: false },
      meta: {},
    }]);
    tldrawEditor.createShape({
      type: "image", x: imgX, y: imgY, opacity: 0.4,
      props: { assetId: imageAssetId, w: canvasW, h: canvasH },
      meta: { layer: 'reference' },
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
        meta: { layer: 'embroidery', elementId },
      } as Parameters<typeof tldrawEditor.createShape>[0]);
    }

    tldrawEditor.zoomToFit();
  }, [tldrawEditor, addElement]);

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
  }

  async function handleDeleteProject() {
    if (!window.confirm(`Deletar projeto "${localProject.name}"? Esta ação não pode ser desfeita.`)) return;
    setDeleting(true);
    try {
      await api.projects.delete(project.id);
      navigate("/");
    } catch (err) {
      alert("Erro ao deletar projeto");
      setDeleting(false);
    }
  }

  return (
    <div style={styles.root}>
      {/* ── Topbar ── */}
      <header style={styles.topbar}>
        <div style={styles.topbarLeft}>
          <span style={styles.logoMark}>🪡</span>
          <span style={styles.projectName}>{localProject.name}</span>
          <SaveStatusIndicator status={saveStatus} lastSavedAt={lastSavedAt} onRetry={retrySync} />
        </div>
        <div style={styles.topbarRight}>
          <button style={styles.newBtn} onClick={onBackToHome} title="Voltar para meus projetos">
            ← Meus projetos
          </button>
          <button style={styles.importBtn} onClick={() => setShowImport(true)}>
            📷 Importar imagem
          </button>
          <button style={styles.exportBtn} onClick={() => setShowExport(true)}>
            ✦ Exportar bordado
          </button>
          <button
            style={{ ...styles.deleteProjectBtn, opacity: deleting ? 0.5 : 1 }}
            onClick={handleDeleteProject}
            disabled={deleting}
            title="Deletar projeto"
          >
            🗑️ Deletar
          </button>
        </div>
      </header>

      {/* ── Main layout ── */}
      <div style={styles.body}>
        <div style={styles.canvas}>
          <Tldraw onMount={handleMount} components={tldrawComponents} />
        </div>

        <aside style={styles.sidebar}>
          <LayersPanel layers={layers} onChange={handleLayersChange} />

          {selectedElement ? (
            <>
              <div style={styles.sidebarHeader}>
                <span style={styles.sidebarTitle}>Propriedades</span>
              </div>
              <PropertiesPanel
                element={selectedElement}
                onChange={(patch) => { void handlePropertiesChange(selectedElement.id, patch); }}
                onDelete={() => handleDeleteElement(selectedElement.id)}
              />
            </>
          ) : (
            <div style={styles.sidebarEmpty}>
              <span style={styles.sidebarEmptyIcon}>👆</span>
              <p style={styles.sidebarEmptyText}>
                Selecione uma área no canvas para configurar o bordado
              </p>
            </div>
          )}

          <div style={styles.elementList}>
            <div style={styles.sidebarHeader}>
              <span style={styles.sidebarTitle}>Áreas ({localProject.elements.length})</span>
            </div>
            {localProject.elements.length === 0 && (
              <p style={styles.emptyHint}>
                Importe uma imagem e analise com IA — a área do bordado é criada automaticamente.
              </p>
            )}
            {localProject.elements.map((el) => (
              <button
                key={el.id}
                style={{ ...styles.elementItem, ...(el.id === selectedElement?.id ? styles.elementItemActive : {}) }}
                onClick={() => handleSelectElement(el.id)}
              >
                <span style={{ ...styles.elementDot, background: el.color }} />
                <span style={styles.elementLabel}>{el.stitch.type} — {el.color}</span>
              </button>
            ))}
          </div>
        </aside>
      </div>

      {showExport && (
        <ExportModal projectId={localProject.id} canvas={localProject.canvas} onClose={() => setShowExport(false)} />
      )}
      {showImport && (
        <ImportModal onClose={() => setShowImport(false)} onConfirm={handleImportConfirm} />
      )}
    </div>
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

const styles: Record<string, React.CSSProperties> = {
  root: { display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" },
  topbar: {
    height: 56, background: "#fff", borderBottom: "1px solid #e2e0db",
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "0 16px", flexShrink: 0, zIndex: 10,
  },
  topbarLeft: { display: "flex", alignItems: "center", gap: 10 },
  logoMark: { fontSize: 22 },
  projectName: { fontSize: 16, fontWeight: 700 },
  saveStatus: {
    fontSize: 12, color: "#9b9b9b", fontWeight: 500,
    border: "none", background: "transparent", padding: 0, fontFamily: "inherit",
  },
  saveStatusError: { color: "#e05252", cursor: "pointer", textDecoration: "underline" },
  topbarRight: { display: "flex", alignItems: "center", gap: 8 },
  newBtn: {
    padding: "8px 14px", borderRadius: 8,
    border: "1.5px solid #e2e0db", background: "#fff",
    fontSize: 13, cursor: "pointer", fontFamily: "inherit", color: "#6b6b6b",
  },
  importBtn: {
    padding: "8px 14px", borderRadius: 8,
    border: "1.5px solid #e2e0db", background: "#fff",
    fontSize: 13, cursor: "pointer", fontFamily: "inherit",
  },
  exportBtn: {
    padding: "8px 16px", borderRadius: 8,
    background: "#7c5cbf", color: "#fff",
    fontSize: 13, fontWeight: 700, cursor: "pointer",
  },
  deleteProjectBtn: {
    padding: "8px 12px", borderRadius: 8,
    background: "#f0f0f0", color: "#666",
    fontSize: 13, fontWeight: 600, cursor: "pointer", border: "none",
    transition: "background 0.15s",
  },
  body: { display: "flex", flex: 1, overflow: "hidden" },
  canvas: { flex: 1, position: "relative" },
  sidebar: {
    width: 260, background: "#fff", borderLeft: "1px solid #e2e0db",
    display: "flex", flexDirection: "column", overflow: "hidden", flexShrink: 0,
  },
  sidebarHeader: { padding: "12px 16px", borderBottom: "1px solid #e2e0db", flexShrink: 0 },
  sidebarTitle: { fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#6b6b6b" },
  sidebarEmpty: {
    display: "flex", flexDirection: "column", alignItems: "center",
    justifyContent: "center", gap: 12, flex: 1, padding: 24, textAlign: "center",
  },
  sidebarEmptyIcon: { fontSize: 32 },
  sidebarEmptyText: { fontSize: 13, color: "#6b6b6b", lineHeight: 1.5 },
  elementList: { borderTop: "1px solid #e2e0db", flexShrink: 0, maxHeight: 200, overflowY: "auto" },
  emptyHint: { fontSize: 12, color: "#9b9b9b", padding: "10px 16px" },
  elementItem: {
    display: "flex", alignItems: "center", gap: 8,
    padding: "9px 16px", width: "100%",
    border: "none", background: "transparent", cursor: "pointer",
    borderBottom: "1px solid #f0ede8", textAlign: "left",
  },
  elementItemActive: { background: "#f5f0ff" },
  elementDot: { width: 12, height: 12, borderRadius: "50%", flexShrink: 0 },
  elementLabel: { fontSize: 12, color: "#1a1a1a", textTransform: "capitalize" },
};
