import { useState, useEffect } from "react";
import { Editor } from "./components/Editor.tsx";
import { Welcome } from "./components/Welcome.tsx";
import type { EmbroideryProject } from "@ponto-studio/shared";
import { api } from "./api/client.ts";

const STORAGE_KEY = "ponto-studio:projectId";

export default function App() {
  const [project, setProject] = useState<EmbroideryProject | null>(null);
  const [loading, setLoading] = useState(true);

  // Na montagem, tenta restaurar o projeto salvo no localStorage
  useEffect(() => {
    const savedId = localStorage.getItem(STORAGE_KEY);
    if (!savedId) {
      setLoading(false);
      return;
    }
    api.projects.get(savedId)
      .then((p) => setProject(p))
      .catch(() => {
        // Projeto não existe mais na API (ex: container reiniciou) — limpa o storage
        localStorage.removeItem(STORAGE_KEY);
      })
      .finally(() => setLoading(false));
  }, []);

  function handleStart(projectId: string) {
    localStorage.setItem(STORAGE_KEY, projectId);
    api.projects.get(projectId).then(setProject);
  }

  function handleProjectChange(p: EmbroideryProject) {
    setProject(p);
    // Sincroniza elementos na API a cada mudança
    api.projects.update(p.id, { name: p.name, canvas: p.canvas, elements: p.elements })
      .catch((err) => console.error("[app] failed to sync project:", err));
  }

  function handleNewProject() {
    localStorage.removeItem(STORAGE_KEY);
    setProject(null);
  }

  if (loading) {
    return (
      <div style={loadingStyle}>
        <span style={{ fontSize: 32 }}>🪡</span>
      </div>
    );
  }

  if (!project) {
    return <Welcome onStart={handleStart} />;
  }

  return (
    <Editor
      project={project}
      onProjectChange={handleProjectChange}
      onNewProject={handleNewProject}
    />
  );
}

const loadingStyle: React.CSSProperties = {
  height: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "linear-gradient(135deg, #f5f0ff 0%, #f5f4f0 100%)",
};
