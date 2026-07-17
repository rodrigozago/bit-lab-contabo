import { useEffect, useRef, useState } from "react";
import { api, pollAnalysisUntilDone } from "../api/client.ts";
import type { ImportConfirmPayload } from "./ImportModal.tsx";

interface Props {
  onClose: () => void;
  onConfirm: (payload: ImportConfirmPayload) => void;
}

const FONTS = [
  { value: "Arial Black, sans-serif", label: "Arial Black (grosso)" },
  { value: "Georgia, serif", label: "Georgia (serifado)" },
  { value: "Impact, sans-serif", label: "Impact (condensado)" },
  { value: "Brush Script MT, cursive", label: "Brush Script (cursiva)" },
  { value: "Courier New, monospace", label: "Courier New (fino)" },
];

const PADDING = 40;
const MAX_DIMENSION = 800; // mesmo teto do worker (analyze.py MAX_DIMENSION)

export function TextToolModal({ onClose, onConfirm }: Props) {
  const [text, setText] = useState("Texto");
  const [font, setFont] = useState(FONTS[0]!.value);
  const [size, setSize] = useState(80);
  const [bold, setBold] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Redesenha o preview toda vez que o texto/fonte/tamanho muda
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const fontSpec = `${bold ? "bold " : ""}${size}px ${font}`;
    ctx.font = fontSpec;
    const content = text || " ";
    const metrics = ctx.measureText(content);
    const textW = Math.max(1, Math.ceil(metrics.width));
    const textH = Math.ceil(size * 1.3); // aproximação de altura de linha

    let w = textW + PADDING * 2;
    let h = textH + PADDING * 2;
    const scale = Math.min(1, MAX_DIMENSION / Math.max(w, h));
    w = Math.round(w * scale);
    h = Math.round(h * scale);

    canvas.width = w;
    canvas.height = h;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.font = fontSpec;
    ctx.scale(scale, scale);
    ctx.fillStyle = "#000000";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(content, (w / 2) / scale, (h / 2) / scale);
  }, [text, font, size, bold]);

  async function handleConfirm() {
    const canvas = canvasRef.current;
    if (!canvas || !text.trim()) return;
    setLoading(true);
    setError("");

    try {
      const previewDataUrl = canvas.toDataURL("image/png");
      const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/png"));
      if (!blob) throw new Error("Não foi possível gerar a imagem do texto");

      const safeName = text.trim().slice(0, 30).replace(/[^\w\s-]/g, "") || "texto";
      const file = new File([blob], `texto-${safeName}.png`, { type: "image/png" });

      // Texto é tipicamente 1 cor/linha só — exclui fundo automaticamente,
      // mesmo pipeline (k-means + vtracer) usado pra fotos importadas.
      const { jobId } = await api.analyze.local(file, {
        colors: 1,
        minRegionPct: 0,
        detail: 2,
        colorTolerance: 10,
        maxAreas: 8,
        excludeBackground: true,
      });
      const svg = await pollAnalysisUntilDone(jobId);

      onConfirm({ file, result: { svg }, previewDataUrl });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao converter o texto em bordado");
      setLoading(false);
    }
  }

  return (
    <div style={s.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={s.modal}>
        <div style={s.header}>
          <span style={s.title}>🔤 Adicionar texto</span>
          <button style={s.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div style={s.body}>
          <label style={s.field}>
            <span style={s.label}>Texto</span>
            <input
              style={s.input}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Digite o texto…"
              maxLength={40}
            />
          </label>

          <label style={s.field}>
            <span style={s.label}>Fonte</span>
            <select style={s.input} value={font} onChange={(e) => setFont(e.target.value)}>
              {FONTS.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
          </label>

          <div style={s.row}>
            <label style={s.field}>
              <span style={s.label}>Tamanho: {size}px</span>
              <input
                type="range" min={30} max={200} step={5} value={size}
                onChange={(e) => setSize(Number(e.target.value))}
                style={s.slider}
              />
            </label>
            <label style={s.checkboxField}>
              <input type="checkbox" checked={bold} onChange={(e) => setBold(e.target.checked)} />
              Negrito
            </label>
          </div>

          <div style={s.previewBox}>
            <canvas ref={canvasRef} style={s.previewCanvas} />
          </div>

          {error && <p style={s.errorMsg}>⚠ {error}</p>}

          <p style={s.hint}>
            O texto é convertido em vetor pelo mesmo processo usado nas imagens importadas —
            fontes grossas (Arial Black, Impact) digitalizam melhor que traços finos.
          </p>

          <div style={s.actions}>
            <button style={s.btnSecondary} onClick={onClose}>Cancelar</button>
            <button
              style={{ ...s.btnPrimary, ...(loading || !text.trim() ? s.btnDisabled : {}) }}
              onClick={() => void handleConfirm()}
              disabled={loading || !text.trim()}
            >
              {loading ? "Convertendo…" : "Adicionar ao bordado →"}
            </button>
          </div>
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
    background: "#fff", borderRadius: 16, width: 480, maxWidth: "92vw",
    maxHeight: "90vh", overflowY: "auto", display: "flex", flexDirection: "column",
    boxShadow: "0 24px 64px rgba(0,0,0,0.22)",
  },
  header: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "16px 20px", borderBottom: "1px solid #e2e0db",
  },
  title: { fontSize: 16, fontWeight: 700 },
  closeBtn: { border: "none", background: "none", fontSize: 16, cursor: "pointer", color: "#6b6b6b" },
  body: { padding: 20, display: "flex", flexDirection: "column", gap: 14 },
  field: { display: "flex", flexDirection: "column", gap: 6, flex: 1 },
  label: { fontSize: 12, fontWeight: 600, color: "#6b6b6b" },
  input: {
    border: "1.5px solid #e2e0db", borderRadius: 8, padding: "9px 12px",
    fontSize: 14, fontFamily: "inherit", outline: "none",
  },
  row: { display: "flex", gap: 16, alignItems: "flex-end" },
  slider: { width: "100%" },
  checkboxField: { display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#1a1a1a", paddingBottom: 9 },
  previewBox: {
    display: "flex", alignItems: "center", justifyContent: "center",
    background: "#f5f4f0", border: "1px solid #e2e0db", borderRadius: 10,
    minHeight: 140, maxHeight: 220, overflow: "hidden", padding: 8,
  },
  previewCanvas: { maxWidth: "100%", maxHeight: 200, objectFit: "contain" },
  errorMsg: { color: "#c0392b", fontSize: 13 },
  hint: { fontSize: 12, color: "#7c5cbf", margin: 0 },
  actions: { display: "flex", justifyContent: "flex-end", gap: 10 },
  btnSecondary: { padding: "10px 18px", borderRadius: 8, border: "1.5px solid #e2e0db", background: "#fff", fontSize: 14, cursor: "pointer" },
  btnPrimary: { padding: "10px 20px", borderRadius: 8, background: "#7c5cbf", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", border: "none" },
  btnDisabled: { opacity: 0.5, cursor: "not-allowed" },
};
