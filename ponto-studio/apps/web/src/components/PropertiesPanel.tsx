import type { EmbroideryElement, StitchType } from "@ponto-studio/shared";

const STITCH_OPTIONS: Array<{ value: StitchType; label: string; desc: string }> = [
  { value: "satin", label: "Cetim", desc: "Linhas paralelas. Ótimo para letras e formas simples." },
  { value: "tatami", label: "Tatami", desc: "Preenchimento uniforme. Ideal para áreas grandes." },
  { value: "running", label: "Corrido", desc: "Contorno e detalhes. Ponto básico de linha." },
];

interface Props {
  element: EmbroideryElement;
  onChange: (patch: Partial<EmbroideryElement>) => void;
  onDelete: () => void;
}

export function PropertiesPanel({ element, onChange, onDelete }: Props) {
  const { stitch, color } = element;

  return (
    <div style={styles.panel}>
      <h3 style={styles.sectionTitle}>Tipo de ponto</h3>
      <div style={styles.stitchList}>
        {STITCH_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            style={{
              ...styles.stitchBtn,
              ...(stitch.type === opt.value ? styles.stitchBtnActive : {}),
            }}
            onClick={() => onChange({ stitch: { ...stitch, type: opt.value } })}
          >
            <span style={styles.stitchLabel}>{opt.label}</span>
            <span style={styles.stitchDesc}>{opt.desc}</span>
          </button>
        ))}
      </div>

      <h3 style={styles.sectionTitle}>Cor do fio</h3>
      <div style={styles.colorRow}>
        <input
          type="color"
          value={color}
          onChange={(e) => onChange({ color: e.target.value })}
          style={styles.colorInput}
        />
        <span style={styles.colorHex}>{color.toUpperCase()}</span>
      </div>

      <h3 style={styles.sectionTitle}>Densidade</h3>
      <div style={styles.sliderRow}>
        <span style={styles.sliderLabel}>Esparso</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={stitch.density}
          onChange={(e) =>
            onChange({ stitch: { ...stitch, density: Number(e.target.value) } })
          }
          style={styles.slider}
        />
        <span style={styles.sliderLabel}>Denso</span>
      </div>
      <div style={styles.sliderValue}>{Math.round(stitch.density * 100)}%</div>

      <h3 style={styles.sectionTitle}>Ângulo</h3>
      <div style={styles.sliderRow}>
        <span style={styles.sliderLabel}>0°</span>
        <input
          type="range"
          min={0}
          max={180}
          step={5}
          value={stitch.angle}
          onChange={(e) =>
            onChange({ stitch: { ...stitch, angle: Number(e.target.value) } })
          }
          style={styles.slider}
        />
        <span style={styles.sliderLabel}>180°</span>
      </div>
      <div style={styles.sliderValue}>{stitch.angle}°</div>

      <button style={styles.deleteBtn} onClick={onDelete}>
        Remover área
      </button>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  panel: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    padding: "16px",
    overflowY: "auto",
    flex: 1,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "#6b6b6b",
    marginTop: 4,
  },
  stitchList: { display: "flex", flexDirection: "column", gap: 6 },
  stitchBtn: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    padding: "10px 12px",
    borderRadius: 8,
    border: "1.5px solid #e2e0db",
    background: "#fff",
    cursor: "pointer",
    textAlign: "left",
    transition: "all 0.12s",
  },
  stitchBtnActive: {
    borderColor: "#7c5cbf",
    background: "#f5f0ff",
  },
  stitchLabel: { fontSize: 14, fontWeight: 600, color: "#1a1a1a" },
  stitchDesc: { fontSize: 11, color: "#6b6b6b", marginTop: 2 },
  colorRow: { display: "flex", alignItems: "center", gap: 10 },
  colorInput: { width: 40, height: 40, borderRadius: 8, border: "none", cursor: "pointer", padding: 0 },
  colorHex: { fontSize: 13, color: "#6b6b6b", fontVariantNumeric: "tabular-nums" },
  sliderRow: { display: "flex", alignItems: "center", gap: 8 },
  sliderLabel: { fontSize: 11, color: "#6b6b6b", width: 40, flexShrink: 0 },
  slider: { flex: 1, accentColor: "#7c5cbf" },
  sliderValue: { fontSize: 13, color: "#7c5cbf", fontWeight: 600, textAlign: "center" },
  deleteBtn: {
    marginTop: 12,
    padding: "10px",
    borderRadius: 8,
    border: "1.5px solid #e2e0db",
    background: "#fff",
    color: "#e05252",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  },
};
