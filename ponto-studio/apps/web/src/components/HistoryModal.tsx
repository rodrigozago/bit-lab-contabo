import { useEffect, useState } from "react";
import { api, type ProjectVersionMeta } from "../api/client.ts";
import { useToast } from "./Toast.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog.tsx";

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
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[80vh] flex-col gap-3.5 overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>🕘 Histórico do projeto</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Versões salvas automaticamente enquanto você edita (no máximo uma a cada 10 minutos).
        </p>

        {versions === null && <p className="text-sm text-muted-foreground">Carregando…</p>}
        {versions?.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Ainda não há versões salvas — elas aparecem conforme você edita o projeto.
          </p>
        )}

        <div className="flex flex-col gap-2">
          {versions?.map((v) => (
            <div key={v.id} className="flex items-center justify-between rounded-md border px-3.5 py-2.5">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-semibold">{formatAgo(v.createdAt)}</span>
                <span className="text-xs text-muted-foreground">
                  {v.elementCount} área{v.elementCount === 1 ? "" : "s"}
                </span>
              </div>
              <Button
                size="sm"
                disabled={restoringId !== null}
                onClick={() => void handleRestore(v)}
              >
                {restoringId === v.id ? "Restaurando…" : "Restaurar"}
              </Button>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
