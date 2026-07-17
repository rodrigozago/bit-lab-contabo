import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Trash2 } from "lucide-react";
import type { EmbroideryProject } from "@ponto-studio/shared";
import { api } from "../api/client.ts";
import { composeThumbnail } from "../utils/svgLayers.ts";
import { Welcome } from "./Welcome.tsx";
import { useToast } from "./Toast.tsx";
import { BaseLayout } from "@/components/layouts/base-layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

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
      <BaseLayout>
        <div className="flex flex-1 items-center justify-center py-24">
          <span className="text-3xl">🪡</span>
        </div>
      </BaseLayout>
    );
  }

  if (creating) {
    return (
      <BaseLayout>
        <Welcome
          onStart={(projectId) => navigate(`/projects/${projectId}`)}
          onCancel={projects.length > 0 ? () => setCreating(false) : undefined}
        />
      </BaseLayout>
    );
  }

  return (
    <BaseLayout
      title="Meus projetos"
      description="Seus bordados digitalizados, prontos pra editar e exportar."
      headerActions={
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus /> Novo projeto
        </Button>
      }
    >
      <div className="flex flex-col gap-4 px-4 lg:px-6">
        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      </div>
    </BaseLayout>
  );
}

function ProjectCard({ project }: { project: EmbroideryProject }) {
  const [deleting, setDeleting] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();
  const thumbnail = composeThumbnail(project.elements);

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    if (!window.confirm(`Deletar projeto "${project.name}"? Esta ação não pode ser desfeita.`)) return;
    setDeleting(true);
    try {
      await api.projects.delete(project.id);
      navigate(0); // reload Home
    } catch (err) {
      toast.error(
        `Erro ao deletar projeto: ${err instanceof Error ? err.message : "erro desconhecido"}`
      );
      setDeleting(false);
    }
  }

  return (
    <div className="relative flex">
      <Link to={`/projects/${project.id}`} className="flex-1">
        <Card className="flex h-full flex-col gap-2.5 p-3 transition-colors hover:border-primary/50 hover:shadow-md">
          <div className="flex h-[140px] items-center justify-center overflow-hidden rounded-md bg-muted">
            {thumbnail ? (
              <div className="h-4/5 w-4/5" dangerouslySetInnerHTML={{ __html: thumbnail }} />
            ) : (
              <span className="text-3xl opacity-40">🪡</span>
            )}
          </div>
          <span className="truncate text-sm font-semibold">{project.name}</span>
        </Card>
      </Link>
      <Button
        variant="secondary"
        size="icon"
        className="absolute right-2 top-2 h-8 w-8 opacity-70 shadow-sm hover:opacity-100"
        onClick={handleDelete}
        disabled={deleting}
        title="Deletar projeto"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
