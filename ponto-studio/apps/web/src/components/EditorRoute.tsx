import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import type { EmbroideryProject } from "@ponto-studio/shared";
import { api } from "../api/client.ts";
import { Editor } from "./Editor.tsx";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Button } from "@/components/ui/button.tsx";

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
      <div className="flex min-h-svh items-center justify-center bg-muted">
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <p className="text-sm text-muted-foreground">Projeto não encontrado.</p>
            <Button variant="link" asChild className="h-auto p-0">
              <Link to="/app">← Meus projetos</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-muted">
        <div className="flex flex-col items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-full" />
          <span className="text-sm text-muted-foreground">Carregando projeto…</span>
        </div>
      </div>
    );
  }

  return (
    <Editor project={project} onProjectChange={handleProjectChange} onBackToHome={() => navigate("/app")} />
  );
}
