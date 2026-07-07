import { useState, useRef, useCallback } from "react";
import { getCached, saveAnalysis, listAnalyses, removeAnalysis } from "../store/analysisCache.ts";
import type { CachedAnalysis } from "../store/analysisCache.ts";
import { api, pollAnalysisUntilDone } from "../api/client.ts";

export interface AnalyzeResult {
  svg: string;
}

type AnalyzeMethod = "local" | "ai";

export interface ImportConfirmPayload {
  file: File;
  result: AnalyzeResult;
  previewDataUrl: string; // sempre disponível, seja de FileReader ou do cache
}

interface Props {
  onClose: () => void;
  onConfirm: (payload: ImportConfirmPayload) => void;
}

// Tela atual do modal
type Screen =
  | "pick"      // escolhe: cache ou nova análise
  | "upload"    // dropzone + botão analisar
  | "process"   // spinner enquanto chama IA
  | "preview";  // mostra resultado lado a lado

export function ImportModal({ onClose, onConfirm }: Props) {
  const cache = listAnalyses();
  // Se não há cache, pula direto para upload
  const [screen, setScreen] = useState<Screen>(cache.length > 0 ? "pick" : "upload");
  const [cachedList, setCachedList] = useState<CachedAnalysis[]>(cache);

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [dragging, setDragging] = useState(false);
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [error, setError] = useState("");
  const [fromCache, setFromCache] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Método de análise: processamento local (default, sem IA) ou IA
  const [method, setMethod] = useState<AnalyzeMethod>("local");
  const [colors, setColors] = useState(4);
  const [minRegionPct, setMinRegionPct] = useState(0.05);

  // ── helpers ──────────────────────────────────────────────────────────────────

  function loadFile(f: File) {
    setFile(f);
    const reader = new FileReader();
    reader.onload = () => setPreviewUrl(reader.result as string);
    reader.readAsDataURL(f);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f && /image\/(png|jpeg|svg\+xml)/.test(f.type)) loadFile(f);
  }

  function handleDeleteCached(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    removeAnalysis(id);
    const updated = listAnalyses();
    setCachedList(updated);
    if (updated.length === 0) setScreen("upload");
  }

  function handleSelectCached(entry: CachedAnalysis) {
    setPreviewUrl(entry.previewDataUrl);
    setResult({ svg: entry.svg });
    setFromCache(true);
    const blob = new Blob([], { type: "image/png" });
    setFile(new File([blob], entry.fileName, { type: "image/png" }));
    setScreen("preview");
  }

  async function handleAnalyze() {
    if (!file) return;
    setError("");

    // Cache só faz atalho no modo IA — no modo local os parâmetros mudam o
    // resultado (e o processamento é rápido), então analisamos sempre.
    if (method === "ai") {
      const cached = getCached(file);
      if (cached) {
        setPreviewUrl(cached.previewDataUrl);
        setResult({ svg: cached.svg });
        setFromCache(true);
        setScreen("preview");
        return;
      }
    }

    setScreen("process");
    setFromCache(false);

    try {
      const previewDataUrl = await new Promise<string>((res, rej) => {
        const reader = new FileReader();
        reader.onload = () => res(reader.result as string);
        reader.onerror = rej;
        reader.readAsDataURL(file);
      });

      const svg = method === "local"
        ? await analyzeLocal(file)
        : await analyzeWithAi(file);

      saveAnalysis(file, previewDataUrl, svg);
      setCachedList(listAnalyses());
      setPreviewUrl(previewDataUrl);
      setResult({ svg });
      setScreen("preview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
      setScreen("upload");
    }
  }

  async function analyzeLocal(f: File): Promise<string> {
    if (f.type === "image/svg+xml") {
      throw new Error("SVG já é vetorial — o processamento local aceita PNG ou JPG.");
    }
    const { jobId } = await api.analyze.local(f, { colors, minRegionPct, detail: 2 });
    return pollAnalysisUntilDone(jobId);
  }

  async function analyzeWithAi(f: File): Promise<string> {
    const form = new FormData();
    form.append("file", f);
    const res = await fetch("/api/analyze", { method: "POST", body: form });

    if (!res.ok) {
      const ct = res.headers.get("content-type") ?? "";
      if (ct.includes("application/json")) {
        const body = await res.json() as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      throw new Error(`Erro ${res.status} — servidor demorou demais. Tente uma imagem menor.`);
    }

    const data = await res.json() as AnalyzeResult;
    return data.svg;
  }

  const handleConfirm = useCallback(() => {
    if (!file || !result) return;
    onConfirm({ file, result, previewDataUrl: previewUrl });
  }, [file, result, previewUrl, onConfirm]);

  // ── títulos por tela ──────────────────────────────────────────────────────────
  const titles: Record<Screen, string> = {
    pick: "Importar imagem",
    upload: "Nova análise",
    process: "Analisando…",
    preview: "Resultado",
  };

  return (
    <div style={s.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={s.modal}>

        {/* ── Header ── */}
        <div style={s.header}>
          <div style={s.headerLeft}>
            {screen !== "pick" && (
              <button
                style={s.backBtn}
                onClick={() => setScreen(cachedList.length > 0 ? "pick" : "upload")}
              >
                ←
              </button>
            )}
            <span style={s.title}>{titles[screen]}</span>
          </div>
          <button style={s.closeBtn} onClick={onClose}>✕</button>
        </div>

        {/* ── Body ── */}
        <div style={s.body}>

          {/* ═══ PICK ═══ */}
          {screen === "pick" && (
            <>
              {/* Botão nova análise */}
              <button style={s.newAnalysisBtn} onClick={() => setScreen("upload")}>
                <span style={s.newAnalysisIcon}>✦</span>
                <div>
                  <div style={s.newAnalysisLabel}>Nova análise</div>
                  <div style={s.newAnalysisHint}>Processamento local (sem IA) ou análise com IA</div>
                </div>
              </button>

              {/* Lista do cache */}
              <p style={s.sectionTitle}>Análises anteriores</p>
              <div style={s.cacheList}>
                {cachedList.map((entry) => (
                  <div
                    key={entry.id}
                    style={s.cacheCard}
                    onClick={() => handleSelectCached(entry)}
                  >
                    <img src={entry.previewDataUrl} alt={entry.fileName} style={s.cacheThumb} />
                    <div style={s.cacheInfo}>
                      <span style={s.cacheName}>{entry.fileName}</span>
                      <span style={s.cacheDate}>
                        {new Date(entry.analyzedAt).toLocaleDateString("pt-BR", {
                          day: "2-digit", month: "short",
                          hour: "2-digit", minute: "2-digit",
                        })}
                      </span>
                      {/* SVG mini-preview */}
                      <div
                        style={s.cacheSvgPreview}
                        dangerouslySetInnerHTML={{ __html: entry.svg }}
                      />
                    </div>
                    <button
                      style={s.deleteBtn}
                      title="Remover do cache"
                      onClick={(e) => handleDeleteCached(e, entry.id)}
                    >
                      🗑
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ═══ UPLOAD ═══ */}
          {screen === "upload" && (
            <>
              <div
                style={{ ...s.dropzone, ...(dragging ? s.dropzoneDrag : {}), ...(file ? s.dropzoneDone : {}) }}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => inputRef.current?.click()}
              >
                {file ? (
                  <div style={s.dropzonePreview}>
                    <img src={previewUrl} alt="preview" style={s.thumbImg} />
                    <span style={s.thumbName}>{file.name}</span>
                    <span style={s.thumbChange}>Clique para trocar</span>
                  </div>
                ) : (
                  <>
                    <span style={s.dropIcon}>🖼️</span>
                    <p style={s.dropText}>Arraste uma imagem ou clique para selecionar</p>
                    <p style={s.dropHint}>PNG, JPG, SVG — até 10 MB</p>
                  </>
                )}
                <input
                  ref={inputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml"
                  style={{ display: "none" }}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) loadFile(f); }}
                />
              </div>

              {/* ── Método de análise ── */}
              <div style={s.methodRow}>
                <button
                  style={{ ...s.methodBtn, ...(method === "local" ? s.methodBtnActive : {}) }}
                  onClick={() => setMethod("local")}
                >
                  <span style={s.methodTitle}>⚙️ Processamento local</span>
                  <span style={s.methodHint}>Rápido, grátis e sempre igual — sem IA</span>
                </button>
                <button
                  style={{ ...s.methodBtn, ...(method === "ai" ? s.methodBtnActive : {}) }}
                  onClick={() => setMethod("ai")}
                >
                  <span style={s.methodTitle}>✦ Análise com IA</span>
                  <span style={s.methodHint}>Envia a imagem para o OpenRouter</span>
                </button>
              </div>

              {method === "local" && (
                <div style={s.paramsBox}>
                  <label style={s.paramLabel}>
                    Nº de cores (linhas de bordado): <strong>{colors}</strong>
                    <input
                      type="range" min={2} max={8} step={1} value={colors}
                      onChange={(e) => setColors(Number(e.target.value))}
                      style={s.paramSlider}
                    />
                  </label>
                  <label style={s.paramLabel}>
                    Ignorar detalhes pequenos: <strong>{minRegionPct.toFixed(2)}%</strong>
                    <input
                      type="range" min={0} max={1} step={0.05} value={minRegionPct}
                      onChange={(e) => setMinRegionPct(Number(e.target.value))}
                      style={s.paramSlider}
                    />
                  </label>
                </div>
              )}

              {error && <p style={s.errorMsg}>⚠ {error}</p>}

              <div style={s.actions}>
                <button style={s.btnSecondary} onClick={onClose}>Cancelar</button>
                <button
                  style={{ ...s.btnPrimary, ...(file ? {} : s.btnDisabled) }}
                  onClick={handleAnalyze}
                  disabled={!file}
                >
                  {method === "local" ? "Processar imagem →" : "Analisar com IA →"}
                </button>
              </div>
            </>
          )}

          {/* ═══ PROCESS ═══ */}
          {screen === "process" && (
            <div style={s.processingBox}>
              <div style={s.spinner} />
              <p style={s.processingTitle}>Gerando vetorial de bordado…</p>
              <p style={s.processingHint}>
                {method === "local"
                  ? "Separando as cores em camadas de bordado"
                  : "A IA está convertendo a imagem em paths SVG"}
              </p>
            </div>
          )}

          {/* ═══ PREVIEW ═══ */}
          {screen === "preview" && result && (
            <>
              {fromCache && (
                <div style={s.cacheNotice}>
                  ⚡ Resultado do cache local — nenhuma chamada à IA foi feita
                </div>
              )}

              <div style={s.previewGrid}>
                <div style={s.previewCol}>
                  <p style={s.previewLabel}>Original</p>
                  <div style={s.previewImgBox}>
                    <img src={previewUrl} alt="original" style={s.previewImg} />
                  </div>
                </div>
                <div style={s.previewCol}>
                  <p style={s.previewLabel}>Vetorial gerado</p>
                  <div style={s.previewImgBox} dangerouslySetInnerHTML={{ __html: result.svg }} />
                </div>
              </div>

              <details style={s.svgDetails}>
                <summary style={s.svgSummary}>Ver código SVG</summary>
                <pre style={s.svgCode}>{result.svg}</pre>
              </details>

              <div style={s.actions}>
                <button style={s.btnSecondary} onClick={() => setScreen(cachedList.length > 0 ? "pick" : "upload")}>
                  ← Voltar
                </button>
                <button style={s.btnPrimary} onClick={handleConfirm}>
                  Incluir no bordado ✦
                </button>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
    display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
  },
  modal: {
    background: "#fff", borderRadius: 16, width: 680, maxWidth: "96vw",
    maxHeight: "90vh", display: "flex", flexDirection: "column",
    boxShadow: "0 24px 64px rgba(0,0,0,0.22)", overflow: "hidden",
  },
  header: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "16px 20px", borderBottom: "1px solid #e2e0db", flexShrink: 0,
  },
  headerLeft: { display: "flex", alignItems: "center", gap: 8 },
  backBtn: {
    background: "none", border: "none", fontSize: 18, cursor: "pointer",
    color: "#6b6b6b", padding: "2px 8px", borderRadius: 6,
    lineHeight: 1,
  },
  title: { fontSize: 16, fontWeight: 700, color: "#1a1a1a" },
  closeBtn: {
    background: "none", border: "none", fontSize: 18, cursor: "pointer",
    color: "#6b6b6b", lineHeight: 1, padding: 4,
  },
  body: { flex: 1, overflowY: "auto", padding: 20 },

  // ── Pick screen ──────────────────────────────────────────────────────────────
  newAnalysisBtn: {
    display: "flex", alignItems: "center", gap: 14,
    width: "100%", padding: "14px 16px", borderRadius: 12, marginBottom: 20,
    border: "2px solid #7c5cbf", background: "#f5f0ff",
    cursor: "pointer", textAlign: "left",
  },
  newAnalysisIcon: { fontSize: 22, color: "#7c5cbf", flexShrink: 0 },
  newAnalysisLabel: { fontSize: 14, fontWeight: 700, color: "#7c5cbf" },
  newAnalysisHint: { fontSize: 12, color: "#9b9b9b", marginTop: 2 },
  sectionTitle: {
    fontSize: 11, fontWeight: 700, textTransform: "uppercase",
    letterSpacing: "0.08em", color: "#9b9b9b", marginBottom: 10,
  },
  cacheList: { display: "flex", flexDirection: "column", gap: 8 },
  cacheCard: {
    display: "flex", alignItems: "flex-start", gap: 12, padding: "10px 12px",
    borderRadius: 10, border: "1.5px solid #e2e0db", background: "#fafaf9",
    cursor: "pointer", transition: "border-color 0.15s", position: "relative",
  },
  cacheThumb: {
    width: 64, height: 48, objectFit: "cover",
    borderRadius: 6, flexShrink: 0, border: "1px solid #e2e0db",
  },
  cacheInfo: { flex: 1, display: "flex", flexDirection: "column", gap: 3, minWidth: 0 },
  cacheName: {
    fontSize: 13, fontWeight: 600, color: "#1a1a1a",
    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
  },
  cacheDate: { fontSize: 11, color: "#9b9b9b" },
  cacheSvgPreview: {
    marginTop: 4, maxHeight: 40, overflow: "hidden",
    opacity: 0.7, pointerEvents: "none",
  },
  deleteBtn: {
    background: "none", border: "none", cursor: "pointer",
    fontSize: 14, color: "#c0c0c0", flexShrink: 0, padding: "2px 4px",
  },

  // ── Upload screen ─────────────────────────────────────────────────────────────
  dropzone: {
    border: "2px dashed #d0ccc8", borderRadius: 12,
    padding: "40px 24px", cursor: "pointer", textAlign: "center",
    transition: "all 0.15s", background: "#fafaf9",
    display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
  },
  dropzoneDrag: { borderColor: "#7c5cbf", background: "#f5f0ff" },
  dropzoneDone: { borderColor: "#7c5cbf", borderStyle: "solid", padding: "20px 24px" },
  dropIcon: { fontSize: 40 },
  dropText: { fontSize: 15, color: "#1a1a1a", fontWeight: 500 },
  dropHint: { fontSize: 13, color: "#9b9b9b" },
  dropzonePreview: { display: "flex", flexDirection: "column", alignItems: "center", gap: 6 },
  methodRow: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 16 },
  methodBtn: {
    display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 3,
    padding: "12px 14px", borderRadius: 10, textAlign: "left",
    border: "1.5px solid #e2e0db", background: "#fff", cursor: "pointer",
  },
  methodBtnActive: { borderColor: "#7c5cbf", background: "#f5f0ff" },
  methodTitle: { fontSize: 13, fontWeight: 700, color: "#1a1a1a" },
  methodHint: { fontSize: 11, color: "#9b9b9b" },
  paramsBox: {
    display: "flex", flexDirection: "column", gap: 12,
    marginTop: 12, padding: "14px 16px",
    background: "#fafaf9", border: "1px solid #e2e0db", borderRadius: 10,
  },
  paramLabel: { fontSize: 13, color: "#1a1a1a", display: "flex", flexDirection: "column", gap: 6 },
  paramSlider: { width: "100%" },
  thumbImg: { width: 120, height: 80, objectFit: "contain", borderRadius: 8 },
  thumbName: { fontSize: 14, fontWeight: 600, color: "#1a1a1a" },
  thumbChange: { fontSize: 12, color: "#7c5cbf" },
  errorMsg: { color: "#c0392b", fontSize: 13, marginTop: 8 },
  actions: { display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 },
  btnPrimary: {
    background: "#7c5cbf", color: "#fff", border: "none",
    borderRadius: 8, padding: "10px 20px", fontSize: 14, fontWeight: 700, cursor: "pointer",
  },
  btnSecondary: {
    background: "#fff", color: "#1a1a1a", border: "1.5px solid #e2e0db",
    borderRadius: 8, padding: "10px 20px", fontSize: 14, cursor: "pointer",
  },
  btnDisabled: { opacity: 0.45, cursor: "not-allowed" },

  // ── Process screen ────────────────────────────────────────────────────────────
  processingBox: {
    display: "flex", flexDirection: "column", alignItems: "center",
    justifyContent: "center", gap: 16, padding: "60px 24px",
  },
  spinner: {
    width: 48, height: 48, borderRadius: "50%",
    border: "4px solid #e2e0db", borderTopColor: "#7c5cbf",
    animation: "spin 0.8s linear infinite",
  },
  processingTitle: { fontSize: 17, fontWeight: 700, color: "#1a1a1a" },
  processingHint: { fontSize: 14, color: "#6b6b6b", textAlign: "center", maxWidth: 360 },

  // ── Preview screen ────────────────────────────────────────────────────────────
  cacheNotice: {
    background: "#f0fdf4", border: "1px solid #bbf7d0",
    borderRadius: 8, padding: "8px 14px",
    fontSize: 13, color: "#16a34a", marginBottom: 16,
  },
  previewGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 },
  previewCol: { display: "flex", flexDirection: "column", gap: 8 },
  previewLabel: {
    fontSize: 12, fontWeight: 700, textTransform: "uppercase",
    letterSpacing: "0.06em", color: "#6b6b6b",
  },
  previewImgBox: {
    border: "1px solid #e2e0db", borderRadius: 10, overflow: "hidden",
    background: "#f5f4f0", display: "flex", alignItems: "center", justifyContent: "center",
    minHeight: 200, maxHeight: 300,
  },
  previewImg: { width: "100%", height: "100%", objectFit: "contain" },
  svgDetails: { marginTop: 12 },
  svgSummary: { fontSize: 13, color: "#7c5cbf", cursor: "pointer", fontWeight: 600 },
  svgCode: {
    marginTop: 8, padding: 12, background: "#f5f4f0", borderRadius: 8,
    fontSize: 11, overflowX: "auto", maxHeight: 160, color: "#333",
    fontFamily: "monospace", whiteSpace: "pre-wrap", wordBreak: "break-all",
  },
};
