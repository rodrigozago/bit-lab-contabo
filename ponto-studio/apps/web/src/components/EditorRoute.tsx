import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import type { EmbroideryProject } from "@ponto-studio/shared";
import { api } from "../api/client.ts";
import { Editor } from "./Editor.tsx";

export function EditorRoute() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<EmbroideryProject | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!id) return;
    setProject(null);
    setError(false);
    api.projects
      .get(id)
      .then(setProject)
      .catch(() => setError(true));
  }, [id]);

  const handleProjectChange = useCallback((p: EmbroideryProject): Promise<void> => {
    setProject(p);
    return api.projects
      .update(p.id, { name: p.name, canvas: p.canvas, elements: p.elements })
      .then(() => {});
  }, []);

  if (error) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <p style={styles.body}>Projeto não encontrado.</p>
          <Link to="/" style={styles.link}>
            ← Meus projetos
          </Link>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div style={styles.page}>
        <div style={styles.loadingBox}>
          <div style={styles.spinner} />
          <span style={styles.loadingText}>Carregando projeto…</span>
        </div>
      </div>
    );
  }

  return (
    <Editor project={project} onProjectChange={handleProjectChange} onBackToHome={() => navigate("/")} />
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
    display: "flex",
    flexDirection: "column",
    gap: 12,
    textAlign: "center",
  },
  body: { fontSize: 14, color: "#6b6b6b", margin: 0 },
  link: { fontSize: 14, fontWeight: 600, color: "#7c5cbf" },
  loadingBox: { display: "flex", flexDirection: "column", alignItems: "center", gap: 12 },
  loadingText: { fontSize: 14, color: "#6b6b6b" },
  spinner: {
    width: 36, height: 36, border: "4px solid #e2e0db",
    borderTop: "4px solid #7c5cbf", borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
};
