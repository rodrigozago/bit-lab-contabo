import type { CanvasSize, StitchPattern } from "@ponto-studio/shared";

interface Props {
  pattern: StitchPattern | null;
  canvas: CanvasSize;
}

/** Calcula o número de trocas de cor (COLOR_BREAK commands) */
function calculateColorChanges(pattern: StitchPattern | null): number {
  if (!pattern || !pattern.stitches) return 0;
  return pattern.stitches.filter((stitch) => stitch[2] === 2).length;
}

/** Formata as dimensões do bastidor como "100 × 80 mm" */
function formatDimensions(canvas: CanvasSize): string {
  return `${Math.round(canvas.widthMm)} × ${Math.round(canvas.heightMm)} mm`;
}

export function EstimateSummary({ pattern, canvas }: Props) {
  if (!pattern) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Carregando estimativas...</div>
      </div>
    );
  }

  const totalStitches = pattern.stats.totalStitches;
  const colorChanges = calculateColorChanges(pattern);
  const dimensions = formatDimensions(canvas);

  return (
    <div style={styles.container}>
      <h3 style={styles.title}>🧵 Estimativas</h3>
      <div style={styles.grid}>
        <div style={styles.item}>
          <div style={styles.icon}>🪡</div>
          <div style={styles.value}>{totalStitches.toLocaleString("pt-BR")}</div>
          <div style={styles.label}>pontos</div>
        </div>
        <div style={styles.item}>
          <div style={styles.icon}>🔄</div>
          <div style={styles.value}>{colorChanges}</div>
          <div style={styles.label}>trocas de cor</div>
        </div>
        <div style={styles.item}>
          <div style={styles.icon}>📐</div>
          <div style={styles.value}>{dimensions}</div>
          <div style={styles.label}>tamanho</div>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    background: "#f9f8f6",
    borderRadius: 12,
    padding: "14px 16px",
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  title: {
    fontSize: 13,
    fontWeight: 700,
    color: "#1a1a1a",
    margin: 0,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  loading: {
    fontSize: 13,
    color: "#6b6b6b",
    textAlign: "center",
    padding: "8px 0",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 12,
  },
  item: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 4,
    padding: "8px",
    borderRadius: 8,
    background: "#fff",
    border: "1px solid #e2e0db",
  },
  icon: {
    fontSize: 18,
  },
  value: {
    fontSize: 15,
    fontWeight: 700,
    color: "#1a1a1a",
  },
  label: {
    fontSize: 11,
    color: "#6b6b6b",
    textAlign: "center",
  },
};
