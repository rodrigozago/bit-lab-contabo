import { useState } from "react";
import type { ExportFormat, ExportJob } from "@ponto-studio/shared";
import { api, pollUntilDone } from "../api/client.ts";

type ModalFormat = ExportFormat | "SVG";

const FORMATS: ModalFormat[] = ["DST", "PES", "JEF", "SVG"];

const FORMAT_DESC: Record<ModalFormat, string> = {
  DST: "Tajima — compatível com a maioria das máquinas",
  PES: "Brother — máquinas Brother/Babylock",
  JEF: "Janome — máquinas Janome/Elna",
  SVG: "Vetorial Ink/Stitch — download imediato, abre no Inkscape",
};

interface Props {
  projectId: string;
  onClose: () => void;
}

type Phase = "select" | "processing" | "done" | "error";

export function ExportModal({ projectId, onClose }: Props) {
  const [format, setFormat] = useState<ModalFormat>("DST");
  const [phase, setPhase] = useState<Phase>("select");
  const [job, setJob] = useState<ExportJob | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [downloadName, setDownloadName] = useState<string | null>(null);

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
    setPhase("processing");
    try {
      if (format === "SVG") {
        await exportSvg();
      } else {
        const created = await api.export.create({ projectId, format });
        setJob(created);
        const finished = await pollUntilDone(created.jobId, setJob);
        setJob(finished);
      }
      setPhase("done");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Erro desconhecido");
      setPhase("error");
    }
  }

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 style={styles.title}>Exportar Bordado</h2>

        {phase === "select" && (
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
              <button style={styles.cancelBtn} onClick={onClose}>Cancelar</button>
              <button style={styles.exportBtn} onClick={handleExport}>
                Exportar .{format}
              </button>
            </div>
          </>
        )}

        {phase === "processing" && (
          <div style={styles.statusBox}>
            <div style={styles.spinner} />
            <p style={styles.statusText}>Gerando arquivo de bordado…</p>
            <p style={styles.statusSub}>Isso pode levar alguns segundos.</p>
          </div>
        )}

        {phase === "done" && job?.downloadUrl && (
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

        {phase === "error" && (
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
    width: 420, boxShadow: "0 16px 48px rgba(0,0,0,0.18)",
    display: "flex", flexDirection: "column", gap: 20,
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
  downloadBtn: {
    padding: "12px 24px", borderRadius: 10, background: "#7c5cbf",
    color: "#fff", fontSize: 15, fontWeight: 700, textDecoration: "none",
  },
};
