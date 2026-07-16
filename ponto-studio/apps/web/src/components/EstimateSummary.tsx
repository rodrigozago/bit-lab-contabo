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

/**
 * Bbox real dos pontos (em mm) — só comandos de costura (STITCH/JUMP com
 * coordenada real); COLOR_BREAK/END vêm em (0,0) e distorceriam o bbox.
 * É a medida fiel do que a máquina borda (EXP-5).
 */
export function stitchBounds(
  pattern: StitchPattern | null
): { widthMm: number; heightMm: number } | null {
  if (!pattern || pattern.stitches.length === 0) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y, cmd] of pattern.stitches) {
    if (cmd !== 0 && cmd !== 1) continue; // só STITCH e JUMP
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  if (!isFinite(minX)) return null;
  return { widthMm: maxX - minX, heightMm: maxY - minY };
}

/** True se o desenho não cabe no bastidor (tolerância de 1mm) — EXP-5 */
export function exceedsHoop(
  bounds: { widthMm: number; heightMm: number } | null,
  canvas: CanvasSize
): boolean {
  if (!bounds) return false;
  return bounds.widthMm > canvas.widthMm + 1 || bounds.heightMm > canvas.heightMm + 1;
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
  const bounds = stitchBounds(pattern);
  const overflow = exceedsHoop(bounds, canvas);
  const designSize = bounds
    ? `${Math.ceil(bounds.widthMm)} × ${Math.ceil(bounds.heightMm)} mm`
    : formatDimensions(canvas);

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
        <div style={{ ...styles.item, ...(overflow ? styles.itemOverflow : {}) }}>
          <div style={styles.icon}>📐</div>
          <div style={styles.value}>{designSize}</div>
          <div style={styles.label}>desenho (bastidor {formatDimensions(canvas)})</div>
        </div>
      </div>
      {overflow && bounds && (
        <div style={styles.overflowWarning}>
          ⚠ O desenho ({Math.ceil(bounds.widthMm)} × {Math.ceil(bounds.heightMm)} mm) extrapola o
          bastidor ({formatDimensions(canvas)}) — a máquina pode recusar ou cortar o bordado.
        </div>
      )}
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
  itemOverflow: {
    border: "1.5px solid #e05252",
    background: "#fff5f5",
  },
  overflowWarning: {
    fontSize: 12,
    color: "#c03030",
    background: "#fff0f0",
    border: "1px solid #f0c0c0",
    borderRadius: 8,
    padding: "8px 12px",
    lineHeight: 1.4,
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
