import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Trash2 } from "lucide-react";
import type { EmbroideryProject } from "@ponto-studio/shared";
import { api } from "../api/client.ts";
import { composeThumbnail } from "../utils/svgLayers.ts";
import { Welcome } from "./Welcome.tsx";
import { UserMenu } from "./UserMenu.tsx";
import { useToast } from "./Toast.tsx";
import { AppSidebar } from "@/components/ui/app-sidebar.tsx";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar.tsx";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Card } from "@/components/ui/card.tsx";

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

  return (
    <SidebarProvider>
      <ResizablePanelGroup direction="horizontal" autoSaveId="ponto-studio-home-layout" className="min-h-svh">
        <ResizablePanel defaultSize={18} minSize={14} maxSize={30}>
          <AppSidebar />
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={82}>
          <SidebarInset>
            {projects === null ? (
              <div className="flex flex-1 items-center justify-center">
                <span className="text-3xl">🪡</span>
              </div>
            ) : creating ? (
              <Welcome
                onStart={(projectId) => navigate(`/projects/${projectId}`)}
                onCancel={projects.length > 0 ? () => setCreating(false) : undefined}
              />
            ) : (
              <div className="flex flex-1 flex-col gap-6 p-6 md:p-8">
                <header className="flex items-center justify-between">
                  <h1 className="text-2xl font-bold">Meus projetos</h1>
                  <div className="flex items-center gap-3">
                    <Button onClick={() => setCreating(true)}>
                      <Plus /> Novo projeto
                    </Button>
                    <UserMenu />
                  </div>
                </header>

                {error && <p className="text-sm text-destructive">{error}</p>}

                <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
                  {projects.map((project) => (
                    <ProjectCard key={project.id} project={project} />
                  ))}
                </div>
              </div>
            )}
          </SidebarInset>
        </ResizablePanel>
      </ResizablePanelGroup>
    </SidebarProvider>
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
        className="absolute right-2 top-2 h-8 w-8 bg-white/90 opacity-70 shadow-sm hover:opacity-100"
        onClick={handleDelete}
        disabled={deleting}
        title="Deletar projeto"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
