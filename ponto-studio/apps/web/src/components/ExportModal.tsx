import { useEffect, useState } from "react";
import type { CanvasSize, ExportFormat, ExportJob, StitchPattern } from "@ponto-studio/shared";
import { api, pollStitchDataUntilDone, pollUntilDone } from "../api/client.ts";
import { StitchPlayer } from "./StitchPlayer.tsx";
import { EstimateSummary } from "./EstimateSummary.tsx";

type ModalFormat = ExportFormat | "SVG";
type ExportStep = "preview" | "format" | "processing" | "done" | "error";
type PreviewPhase = "loading" | "ready" | "error";

const FORMATS: ModalFormat[] = ["DST", "PES", "JEF", "SVG"];

const FORMAT_DESC: Record<ModalFormat, string> = {
  DST: "Tajima — compatível com a maioria das máquinas",
  PES: "Brother — máquinas Brother/Babylock",
  JEF: "Janome — máquinas Janome/Elna",
  SVG: "Vetorial Ink/Stitch — download imediato, abre no Inkscape",
};

interface Props {
  projectId: string;
  canvas: CanvasSize;
  onClose: () => void;
}

export function ExportModal({ projectId, canvas, onClose }: Props) {
  const [step, setStep] = useState<ExportStep>("preview");
  const [format, setFormat] = useState<ModalFormat>("DST");
  const [job, setJob] = useState<ExportJob | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [downloadName, setDownloadName] = useState<string | null>(null);

  // Player de simulação (EXP-2)
  const [previewPhase, setPreviewPhase] = useState<PreviewPhase>("loading");
  const [pattern, setPattern] = useState<StitchPattern | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { jobId } = await api.stitchPreview.create(projectId);
        const result = await pollStitchDataUntilDone(jobId);
        if (!cancelled) {
          setPattern(result);
          setPreviewPhase("ready");
        }
      } catch {
        if (!cancelled) setPreviewPhase("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  // Exportação SVG é síncrona: a API devolve o arquivo direto (sem worker)
  async function exportSvg() {
    const res = await fetch("/api/export/svg", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId }),
    });
    if (!res.ok) throw new Error(`Falha na exportação (HTTP ${res.status})`);

    const disposition = res.headers.get("content-disposition") ?? "";
    const fileName = /filename="([^"]+)"/.exec(disposition)?.[1] ?? "bordado.svg";
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);

    const now = new Date().toISOString();
    setJob({
      jobId: "svg-local", projectId, format: "DST", status: "done",
      downloadUrl: url, createdAt: now, updatedAt: now,
    });
    setDownloadName(fileName);
  }

  async function handleExport() {
    setStep("processing");
    try {
      if (format === "SVG") {
        await exportSvg();
      } else {
        const created = await api.export.create({ projectId, format });
        setJob(created);
        const finished = await pollUntilDone(created.jobId, setJob);
        setJob(finished);
      }
      setStep("done");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Erro desconhecido");
      setStep("error");
    }
  }

  function handleFormatSelected() {
    setStep("format");
  }

  function handleBackToPreview() {
    setStep("preview");
  }

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 style={styles.title}>Exportar Bordado</h2>

        {/* Stepper indicator */}
        <div style={styles.stepperIndicator}>
          <div style={{ ...styles.step, ...(step === "preview" || step === "format" || step === "processing" || step === "done" || step === "error" ? styles.stepActive : {}) }}>
            <div style={styles.stepNumber}>1</div>
            <div style={styles.stepLabel}>Pré-visualização</div>
          </div>
          <div style={styles.stepLine} />
          <div style={{ ...styles.step, ...(step === "format" || step === "processing" || step === "done" || step === "error" ? styles.stepActive : {}) }}>
            <div style={styles.stepNumber}>2</div>
            <div style={styles.stepLabel}>Formato</div>
          </div>
        </div>

        {/* Step 1: Preview */}
        {step === "preview" && (
          <>
            {previewPhase === "loading" && (
              <div style={styles.previewLoading}>
                <div style={styles.spinnerSmall} />
                <span>Gerando pré-visualização dos pontos…</span>
              </div>
            )}
            {previewPhase === "ready" && pattern && (
              <>
                <StitchPlayer pattern={pattern} />
                <EstimateSummary pattern={pattern} canvas={canvas} />
              </>
            )}
            {previewPhase === "error" && (
              <p style={styles.errorText}>Erro ao gerar pré-visualização</p>
            )}
            <div style={styles.actions}>
              <button style={styles.cancelBtn} onClick={onClose}>Cancelar</button>
              <button
                style={styles.exportBtn}
                onClick={handleFormatSelected}
                disabled={previewPhase !== "ready"}
              >
                Próximo →
              </button>
            </div>
          </>
        )}

        {/* Step 2: Format Selection */}
        {step === "format" && (
          <>
            <p style={styles.subtitle}>Escolha o formato compatível com sua máquina:</p>
            <div style={styles.formatList}>
              {FORMATS.map((f) => (
                <button
                  key={f}
                  style={{ ...styles.formatBtn, ...(format === f ? styles.formatBtnActive : {}) }}
                  onClick={() => setFormat(f)}
                >
                  <span style={styles.formatName}>.{f}</span>
                  <span style={styles.formatDesc}>{FORMAT_DESC[f]}</span>
                </button>
              ))}
            </div>
            <div style={styles.actions}>
              <button style={styles.cancelBtn} onClick={handleBackToPreview}>← Voltar</button>
              <button style={styles.exportBtn} onClick={handleExport}>
                Exportar .{format}
              </button>
            </div>
          </>
        )}

        {/* Processing state */}
        {step === "processing" && (
          <div style={styles.statusBox}>
            <div style={styles.spinner} />
            <p style={styles.statusText}>Gerando arquivo de bordado…</p>
            <p style={styles.statusSub}>Isso pode levar alguns segundos.</p>
          </div>
        )}

        {/* Done state */}
        {step === "done" && job?.downloadUrl && (
          <div style={styles.statusBox}>
            <div style={styles.checkIcon}>✓</div>
            <p style={styles.statusText}>Pronto!</p>
            <a
              href={job.downloadUrl}
              download={downloadName ?? true}
              style={styles.downloadBtn}
            >
              Baixar .{format}
            </a>
            <button style={styles.cancelBtn} onClick={onClose}>Fechar</button>
          </div>
        )}

        {/* Error state */}
        {step === "error" && (
          <div style={styles.statusBox}>
            <div style={styles.errorIcon}>✕</div>
            <p style={styles.statusText}>Erro na exportação</p>
            <p style={styles.statusSub}>{errorMsg}</p>
            <button style={styles.cancelBtn} onClick={onClose}>Fechar</button>
          </div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
    display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
  },
  modal: {
    background: "#fff", borderRadius: 16, padding: "32px 36px",
    width: 520, maxWidth: "94vw", boxShadow: "0 16px 48px rgba(0,0,0,0.18)",
    display: "flex", flexDirection: "column", gap: 20, maxHeight: "90vh", overflowY: "auto",
  },
  stepperIndicator: {
    display: "flex", alignItems: "center", gap: 16, justifyContent: "center", padding: "8px 0",
  },
  step: {
    display: "flex", flexDirection: "column", alignItems: "center", gap: 6, opacity: 0.5,
    transition: "opacity 0.2s",
  },
  stepActive: { opacity: 1 },
  stepNumber: {
    width: 32, height: 32, borderRadius: "50%", background: "#e2e0db",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 14, fontWeight: 700, color: "#6b6b6b",
  },
  stepLabel: { fontSize: 11, color: "#6b6b6b", fontWeight: 600, textAlign: "center" },
  stepLine: { width: 20, height: 2, background: "#e2e0db" },
  previewLoading: {
    display: "flex", alignItems: "center", gap: 10,
    fontSize: 13, color: "#6b6b6b", padding: "8px 0",
  },
  spinnerSmall: {
    width: 18, height: 18, border: "3px solid #e2e0db",
    borderTop: "3px solid #7c5cbf", borderRadius: "50%",
    animation: "spin 0.8s linear infinite", flexShrink: 0,
  },
  title: { fontSize: 22, fontWeight: 700 },
  subtitle: { fontSize: 14, color: "#6b6b6b" },
  formatList: { display: "flex", flexDirection: "column", gap: 8 },
  formatBtn: {
    display: "flex", flexDirection: "column", alignItems: "flex-start",
    padding: "12px 14px", borderRadius: 10,
    border: "1.5px solid #e2e0db", background: "#fff", cursor: "pointer", textAlign: "left",
  },
  formatBtnActive: { borderColor: "#7c5cbf", background: "#f5f0ff" },
  formatName: { fontSize: 16, fontWeight: 700, color: "#1a1a1a" },
  formatDesc: { fontSize: 12, color: "#6b6b6b", marginTop: 2 },
  actions: { display: "flex", gap: 10, justifyContent: "flex-end" },
  cancelBtn: { padding: "10px 18px", borderRadius: 8, border: "1.5px solid #e2e0db", background: "#fff", fontSize: 14, cursor: "pointer" },
  exportBtn: { padding: "10px 20px", borderRadius: 8, background: "#7c5cbf", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" },
  statusBox: { display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "20px 0" },
  statusText: { fontSize: 18, fontWeight: 700 },
  statusSub: { fontSize: 13, color: "#6b6b6b" },
  spinner: {
    width: 40, height: 40, border: "4px solid #e2e0db",
    borderTop: "4px solid #7c5cbf", borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
  checkIcon: { width: 48, height: 48, borderRadius: "50%", background: "#e6f9f0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, color: "#22c55e" },
  errorIcon: { width: 48, height: 48, borderRadius: "50%", background: "#fff0f0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, color: "#e05252" },
  errorText: { fontSize: 13, color: "#e05252", textAlign: "center", padding: "12px 0" },
  downloadBtn: {
    padding: "12px 24px", borderRadius: 10, background: "#7c5cbf",
    color: "#fff", fontSize: 15, fontWeight: 700, textDecoration: "none",
  },
};
