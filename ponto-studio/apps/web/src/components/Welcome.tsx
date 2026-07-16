import { useEffect, useState } from "react";
import type { Hoop } from "@ponto-studio/shared";
import { api } from "../api/client.ts";

interface Props {
  onStart: (projectId: string) => void;
  onCancel?: () => void;
}

export function Welcome({ onStart, onCancel }: Props) {
  const [name, setName] = useState("Meu Bordado");
  const [customHoops, setCustomHoops] = useState<Hoop[]>([]);
  const [defaultHoops, setDefaultHoops] = useState<Hoop[]>([]);
  const [selectedHoopId, setSelectedHoopId] = useState<string | null>(null);
  const [hoopsLoading, setHoopsLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // form de bastidor customizado
  const [showHoopForm, setShowHoopForm] = useState(false);
  const [hoopName, setHoopName] = useState("");
  const [hoopW, setHoopW] = useState("100");
  const [hoopH, setHoopH] = useState("100");
  const [hoopSaving, setHoopSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const { custom, defaults } = await api.hoops.list();
        setCustomHoops(custom);
        setDefaultHoops(defaults);
        // pré-seleciona: primeiro customizado, senão o primeiro padrão
        setSelectedHoopId(custom[0]?.id ?? defaults[0]?.id ?? null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao carregar bastidores");
      } finally {
        setHoopsLoading(false);
      }
    })();
  }, []);

  const allHoops = [...customHoops, ...defaultHoops];
  const selectedHoop = allHoops.find((h) => h.id === selectedHoopId) ?? null;

  async function handleCreate() {
    if (!selectedHoop || !name.trim()) return;
    setLoading(true);
    setError("");
    try {
      const project = await api.projects.create({
        name: name.trim(),
        canvas: { widthMm: selectedHoop.widthMm, heightMm: selectedHoop.heightMm },
      });
      onStart(project.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar projeto");
      setLoading(false);
    }
  }

  async function handleCreateHoop() {
    const widthMm = Number(hoopW);
    const heightMm = Number(hoopH);
    if (!hoopName.trim() || !isFinite(widthMm) || !isFinite(heightMm)) return;
    setHoopSaving(true);
    setError("");
    try {
      const hoop = await api.hoops.create({ name: hoopName.trim(), widthMm, heightMm });
      setCustomHoops((prev) => [hoop, ...prev]);
      setSelectedHoopId(hoop.id);
      setShowHoopForm(false);
      setHoopName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar bastidor");
    } finally {
      setHoopSaving(false);
    }
  }

  async function handleDeleteHoop(id: string) {
    try {
      await api.hoops.delete(id);
      setCustomHoops((prev) => prev.filter((h) => h.id !== id));
      if (selectedHoopId === id) {
        setSelectedHoopId(defaultHoops[0]?.id ?? null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao deletar bastidor");
    }
  }

  function hoopOption(hoop: Hoop, isCustom: boolean) {
    return (
      <div key={hoop.id} style={styles.hoopRow}>
        <button
          style={{
            ...styles.hoopBtn,
            ...(hoop.id === selectedHoopId ? styles.hoopBtnActive : {}),
          }}
          onClick={() => setSelectedHoopId(hoop.id)}
        >
          <span style={styles.hoopName}>
            {isCustom && <span style={styles.customBadge}>meu</span>}
            {hoop.name}
          </span>
          <span style={styles.hoopSize}>
            {Math.round(hoop.widthMm)} × {Math.round(hoop.heightMm)} mm
          </span>
        </button>
        {isCustom && (
          <button
            style={styles.hoopDeleteBtn}
            title="Deletar bastidor"
            onClick={() => void handleDeleteHoop(hoop.id)}
          >
            🗑
          </button>
        )}
      </div>
    );
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
          <label style={styles.label}>Bastidor</label>
          {hoopsLoading ? (
            <p style={styles.hoopHint}>Carregando bastidores…</p>
          ) : (
            <div style={styles.hoopList}>
              {customHoops.map((h) => hoopOption(h, true))}
              {defaultHoops.map((h) => hoopOption(h, false))}
            </div>
          )}

          {!showHoopForm ? (
            <button style={styles.addHoopBtn} onClick={() => setShowHoopForm(true)}>
              ＋ Bastidor customizado
            </button>
          ) : (
            <div style={styles.hoopForm}>
              <input
                style={styles.input}
                value={hoopName}
                onChange={(e) => setHoopName(e.target.value)}
                placeholder="Nome (ex: Meu bastidor 15cm)"
              />
              <div style={styles.hoopFormRow}>
                <input
                  style={{ ...styles.input, flex: 1 }}
                  type="number"
                  min={10}
                  max={600}
                  value={hoopW}
                  onChange={(e) => setHoopW(e.target.value)}
                  placeholder="Largura mm"
                />
                <span style={styles.hoopX}>×</span>
                <input
                  style={{ ...styles.input, flex: 1 }}
                  type="number"
                  min={10}
                  max={600}
                  value={hoopH}
                  onChange={(e) => setHoopH(e.target.value)}
                  placeholder="Altura mm"
                />
                <span style={styles.hoopHint}>mm</span>
              </div>
              <div style={styles.hoopFormActions}>
                <button style={styles.hoopFormCancel} onClick={() => setShowHoopForm(false)}>
                  Cancelar
                </button>
                <button
                  style={styles.hoopFormSave}
                  onClick={() => void handleCreateHoop()}
                  disabled={hoopSaving || !hoopName.trim()}
                >
                  {hoopSaving ? "Salvando…" : "Salvar bastidor"}
                </button>
              </div>
            </div>
          )}
        </div>

        <button
          style={styles.cta}
          onClick={() => void handleCreate()}
          disabled={!name.trim() || !selectedHoop || loading}
        >
          {loading ? "Criando…" : "Criar projeto →"}
        </button>
        {error && <p style={styles.errorMsg}>{error}</p>}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(135deg, #f5f0ff 0%, #f5f4f0 100%)",
    padding: "24px 0",
  },
  card: {
    background: "#fff",
    borderRadius: 16,
    padding: "40px 48px",
    width: 460,
    boxShadow: "0 8px 32px rgba(124,92,191,0.12)",
    display: "flex",
    flexDirection: "column",
    gap: 20,
    maxHeight: "92vh",
    overflowY: "auto",
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
  hoopList: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    maxHeight: 240,
    overflowY: "auto",
    paddingRight: 4,
  },
  hoopRow: { display: "flex", alignItems: "stretch", gap: 6 },
  hoopBtn: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    padding: "9px 12px",
    borderRadius: 8,
    border: "1.5px solid #e2e0db",
    background: "#fff",
    fontSize: 13,
    cursor: "pointer",
    transition: "all 0.15s",
    color: "#1a1a1a",
    textAlign: "left",
  },
  hoopBtnActive: {
    borderColor: "#7c5cbf",
    background: "#f5f0ff",
    color: "#7c5cbf",
    fontWeight: 600,
  },
  hoopName: { display: "flex", alignItems: "center", gap: 6, minWidth: 0 },
  hoopSize: { fontSize: 12, color: "#6b6b6b", flexShrink: 0, fontVariantNumeric: "tabular-nums" },
  customBadge: {
    fontSize: 9,
    fontWeight: 700,
    textTransform: "uppercase",
    color: "#fff",
    background: "#7c5cbf",
    borderRadius: 4,
    padding: "1px 5px",
    flexShrink: 0,
  },
  hoopDeleteBtn: {
    border: "1.5px solid #e2e0db",
    borderRadius: 8,
    background: "#fff",
    cursor: "pointer",
    fontSize: 12,
    padding: "0 8px",
    opacity: 0.7,
  },
  addHoopBtn: {
    marginTop: 4,
    padding: "8px 12px",
    borderRadius: 8,
    border: "1.5px dashed #c9c2e8",
    background: "#faf8ff",
    color: "#7c5cbf",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  },
  hoopForm: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    padding: "12px",
    borderRadius: 10,
    border: "1.5px solid #e2e0db",
    background: "#fafaf9",
    marginTop: 4,
  },
  hoopFormRow: { display: "flex", alignItems: "center", gap: 8 },
  hoopX: { fontSize: 14, color: "#6b6b6b" },
  hoopHint: { fontSize: 12, color: "#6b6b6b" },
  hoopFormActions: { display: "flex", justifyContent: "flex-end", gap: 8 },
  hoopFormCancel: {
    padding: "7px 12px",
    borderRadius: 8,
    border: "1.5px solid #e2e0db",
    background: "#fff",
    fontSize: 12,
    cursor: "pointer",
  },
  hoopFormSave: {
    padding: "7px 14px",
    borderRadius: 8,
    border: "none",
    background: "#7c5cbf",
    color: "#fff",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
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
