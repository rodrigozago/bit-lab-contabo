import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { EmbroideryProject } from "@ponto-studio/shared";
import { api } from "../api/client.ts";
import { composeThumbnail } from "../utils/svgLayers.ts";
import { Welcome } from "./Welcome.tsx";

export function Home() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<EmbroideryProject[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const list = await api.projects.list();
      setProjects(list);
      if (list.length === 0) setCreating(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar projetos");
      setProjects([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (projects === null) {
    return (
      <div style={styles.page}>
        <span style={{ fontSize: 32 }}>🪡</span>
      </div>
    );
  }

  if (creating) {
    return (
      <Welcome
        onStart={(projectId) => navigate(`/projects/${projectId}`)}
        onCancel={projects.length > 0 ? () => setCreating(false) : undefined}
      />
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <header style={styles.header}>
          <div style={styles.headerLeft}>
            <span style={styles.logo}>🪡</span>
            <h1 style={styles.title}>Meus projetos</h1>
          </div>
          <button style={styles.newBtn} onClick={() => setCreating(true)}>
            ＋ Novo projeto
          </button>
        </header>

        {error && <p style={styles.errorMsg}>{error}</p>}

        <div style={styles.grid}>
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      </div>
    </div>
  );
}

function ProjectCard({ project }: { project: EmbroideryProject }) {
  const thumbnail = composeThumbnail(project.elements);
  return (
    <Link to={`/projects/${project.id}`} style={styles.card}>
      <div style={styles.thumbBox}>
        {thumbnail ? (
          <div style={styles.thumbSvg} dangerouslySetInnerHTML={{ __html: thumbnail }} />
        ) : (
          <span style={styles.thumbPlaceholder}>🪡</span>
        )}
      </div>
      <span style={styles.cardName}>{project.name}</span>
    </Link>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    display: "flex",
    justifyContent: "center",
    background: "linear-gradient(135deg, #f5f0ff 0%, #f5f4f0 100%)",
    padding: "48px 24px",
  },
  container: { width: "100%", maxWidth: 1000, display: "flex", flexDirection: "column", gap: 24 },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between" },
  headerLeft: { display: "flex", alignItems: "center", gap: 12 },
  logo: { fontSize: 28 },
  title: { fontSize: 24, fontWeight: 700, color: "#1a1a1a", margin: 0 },
  newBtn: {
    background: "#7c5cbf",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    padding: "12px 20px",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
  },
  errorMsg: { fontSize: 13, color: "#e05252" },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
    gap: 16,
  },
  card: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    padding: 12,
    borderRadius: 12,
    border: "1.5px solid #e2e0db",
    background: "#fff",
    cursor: "pointer",
    textDecoration: "none",
    color: "inherit",
    transition: "border-color 0.15s, box-shadow 0.15s",
  },
  thumbBox: {
    height: 140,
    borderRadius: 8,
    background: "#fafaf9",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  thumbSvg: { width: "80%", height: "80%" },
  thumbPlaceholder: { fontSize: 32, opacity: 0.4 },
  cardName: { fontSize: 14, fontWeight: 600, color: "#1a1a1a" },
};
