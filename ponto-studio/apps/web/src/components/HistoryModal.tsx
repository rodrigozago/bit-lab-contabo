import { useEffect, useState } from "react";
import { api, type ProjectVersionMeta } from "../api/client.ts";
import { useToast } from "./Toast.tsx";

interface Props {
  projectId: string;
  onClose: () => void;
  onRestored: () => void;
}

/** "há 23min" / "há 2h" / "há 3 dias" */
function formatAgo(iso: string): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (diffSec < 60) return "agora mesmo";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `há ${diffMin}min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `há ${diffH}h`;
  const diffDays = Math.floor(diffH / 24);
  return `há ${diffDays} dia${diffDays > 1 ? "s" : ""}`;
}

export function HistoryModal({ projectId, onClose, onRestored }: Props) {
  const toast = useToast();
  const [versions, setVersions] = useState<ProjectVersionMeta[] | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        setVersions(await api.projects.versions(projectId));
      } catch (err) {
        toast.error(
          `Erro ao carregar histórico: ${err instanceof Error ? err.message : "erro desconhecido"}`
        );
        onClose();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function handleRestore(version: ProjectVersionMeta) {
    if (
      !window.confirm(
        `Restaurar o projeto para o estado de ${formatAgo(version.createdAt)} (${version.elementCount} área(s))? O estado atual é salvo antes de restaurar.`
      )
    )
      return;
    setRestoringId(version.id);
    try {
      await api.projects.restoreVersion(projectId, version.id);
      onRestored();
    } catch (err) {
      toast.error(
        `Erro ao restaurar versão: ${err instanceof Error ? err.message : "erro desconhecido"}`
      );
      setRestoringId(null);
    }
  }

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 style={styles.title}>🕘 Histórico do projeto</h2>
        <p style={styles.subtitle}>
          Versões salvas automaticamente enquanto você edita (no máximo uma a cada 10 minutos).
        </p>

        {versions === null && <p style={styles.hint}>Carregando…</p>}
        {versions?.length === 0 && (
          <p style={styles.hint}>Ainda não há versões salvas — elas aparecem conforme você edita o projeto.</p>
        )}

        <div style={styles.list}>
          {versions?.map((v) => (
            <div key={v.id} style={styles.item}>
              <div style={styles.itemInfo}>
                <span style={styles.itemTime}>{formatAgo(v.createdAt)}</span>
                <span style={styles.itemMeta}>{v.elementCount} área{v.elementCount === 1 ? "" : "s"}</span>
              </div>
              <button
                style={styles.restoreBtn}
                disabled={restoringId !== null}
                onClick={() => void handleRestore(v)}
              >
                {restoringId === v.id ? "Restaurando…" : "Restaurar"}
              </button>
            </div>
          ))}
        </div>

        <div style={styles.actions}>
          <button style={styles.closeBtn} onClick={onClose}>Fechar</button>
        </div>
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
    background: "#fff", borderRadius: 16, padding: "28px 32px",
    width: 460, maxWidth: "92vw", maxHeight: "80vh", overflowY: "auto",
    boxShadow: "0 16px 48px rgba(0,0,0,0.18)",
    display: "flex", flexDirection: "column", gap: 14,
  },
  title: { fontSize: 20, fontWeight: 700, margin: 0 },
  subtitle: { fontSize: 13, color: "#6b6b6b", margin: 0 },
  hint: { fontSize: 13, color: "#6b6b6b" },
  list: { display: "flex", flexDirection: "column", gap: 8 },
  item: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "10px 14px", borderRadius: 10, border: "1.5px solid #e2e0db",
  },
  itemInfo: { display: "flex", flexDirection: "column", gap: 2 },
  itemTime: { fontSize: 14, fontWeight: 600, color: "#1a1a1a" },
  itemMeta: { fontSize: 12, color: "#6b6b6b" },
  restoreBtn: {
    padding: "7px 14px", borderRadius: 8, border: "none",
    background: "#7c5cbf", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer",
  },
  actions: { display: "flex", justifyContent: "flex-end" },
  closeBtn: { padding: "9px 16px", borderRadius: 8, border: "1.5px solid #e2e0db", background: "#fff", fontSize: 13, cursor: "pointer" },
};
