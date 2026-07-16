import { useState } from "react";
import type { CanvasSize } from "@ponto-studio/shared";
import { api } from "../api/client.ts";

const PRESET_SIZES: Array<{ label: string; canvas: CanvasSize }> = [
  { label: "Quadrado 100×100 mm", canvas: { widthMm: 100, heightMm: 100 } },
  { label: "Retrato 100×150 mm", canvas: { widthMm: 100, heightMm: 150 } },
  { label: "Paisagem 150×100 mm", canvas: { widthMm: 150, heightMm: 100 } },
  { label: "Grande 200×200 mm", canvas: { widthMm: 200, heightMm: 200 } },
];

interface Props {
  onStart: (projectId: string) => void;
  onCancel?: () => void;
}

export function Welcome({ onStart, onCancel }: Props) {
  const [name, setName] = useState("Meu Bordado");
  const [selectedSize, setSelectedSize] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleCreate() {
    const preset = PRESET_SIZES[selectedSize];
    if (!preset || !name.trim()) return;
    setLoading(true);
    setError("");
    try {
      const project = await api.projects.create({ name: name.trim(), canvas: preset.canvas });
      onStart(project.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar projeto");
      setLoading(false);
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        {onCancel && (
          <button style={styles.backLink} onClick={onCancel}>
            ← Voltar
          </button>
        )}
        <div style={styles.logo}>🪡</div>
        <h1 style={styles.title}>Ponto Studio</h1>
        <p style={styles.subtitle}>Digitalize seus bordados</p>

        <div style={styles.field}>
          <label style={styles.label}>Nome do projeto</label>
          <input
            style={styles.input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Floral Primavera"
          />
        </div>

        <div style={styles.field}>
          <label style={styles.label}>Tamanho do bastidor</label>
          <div style={styles.sizeGrid}>
            {PRESET_SIZES.map((p, i) => (
              <button
                key={i}
                style={{
                  ...styles.sizeBtn,
                  ...(i === selectedSize ? styles.sizeBtnActive : {}),
                }}
                onClick={() => setSelectedSize(i)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <button style={styles.cta} onClick={handleCreate} disabled={!name.trim() || loading}>
          {loading ? "Criando…" : "Criar projeto →"}
        </button>
        {error && <p style={styles.errorMsg}>{error}</p>}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    height: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(135deg, #f5f0ff 0%, #f5f4f0 100%)",
  },
  card: {
    background: "#fff",
    borderRadius: 16,
    padding: "40px 48px",
    width: 420,
    boxShadow: "0 8px 32px rgba(124,92,191,0.12)",
    display: "flex",
    flexDirection: "column",
    gap: 20,
  },
  backLink: {
    alignSelf: "flex-start",
    background: "none",
    border: "none",
    padding: 0,
    fontSize: 13,
    fontWeight: 600,
    color: "#7c5cbf",
    cursor: "pointer",
  },
  logo: { fontSize: 40, textAlign: "center" },
  title: { fontSize: 28, fontWeight: 700, textAlign: "center", color: "#1a1a1a" },
  subtitle: { fontSize: 14, textAlign: "center", color: "#7c5cbf", marginTop: -14 },
  field: { display: "flex", flexDirection: "column", gap: 8 },
  label: { fontSize: 13, fontWeight: 600, color: "#6b6b6b", textTransform: "uppercase", letterSpacing: "0.05em" },
  input: {
    border: "1.5px solid #e2e0db",
    borderRadius: 8,
    padding: "10px 14px",
    fontSize: 15,
    outline: "none",
    transition: "border-color 0.15s",
    fontFamily: "inherit",
  },
  sizeGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 },
  sizeBtn: {
    padding: "10px 12px",
    borderRadius: 8,
    border: "1.5px solid #e2e0db",
    background: "#fff",
    fontSize: 13,
    cursor: "pointer",
    transition: "all 0.15s",
    color: "#1a1a1a",
  },
  sizeBtnActive: {
    borderColor: "#7c5cbf",
    background: "#f5f0ff",
    color: "#7c5cbf",
    fontWeight: 600,
  },
  cta: {
    background: "#7c5cbf",
    color: "#fff",
    borderRadius: 10,
    padding: "14px",
    fontSize: 16,
    fontWeight: 700,
    marginTop: 4,
    transition: "background 0.15s",
  },
  errorMsg: {
    fontSize: 13,
    color: "#e05252",
    textAlign: "center" as const,
  },
};
