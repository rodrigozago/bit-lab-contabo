import { useState } from "react";
import type { DesignTemplate } from "@ponto-studio/shared";
import { api } from "../api/client.ts";
import { useToast } from "./Toast.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog.tsx";

interface Props {
  projectId: string;
  /** nome do projeto atual — usado como sugestão inicial pro nome no catálogo */
  defaultName: string;
  onClose: () => void;
  onPublished: (template: DesignTemplate) => void;
}

/**
 * Publica o projeto atual (do próprio admin) como matriz no catálogo global —
 * só admin chega aqui (o botão "Publicar como matriz" na sidebar só aparece
 * quando `me.isAdmin`; a rota também exige admin no backend). O nome no
 * catálogo pode divergir do nome do projeto privado.
 */
export function PublishTemplateModal({ projectId, defaultName, onClose, onPublished }: Props) {
  const toast = useToast();
  const [name, setName] = useState(defaultName);
  const [publishing, setPublishing] = useState(false);

  async function handlePublish() {
    if (!name.trim()) return;
    setPublishing(true);
    try {
      const template = await api.templates.publish({ projectId, name: name.trim() });
      toast.info(`"${template.name}" publicada na biblioteca de matrizes.`);
      onPublished(template);
      onClose();
    } catch (err) {
      toast.error(
        `Erro ao publicar a matriz: ${err instanceof Error ? err.message : "erro desconhecido"}`
      );
      setPublishing(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>✦ Publicar como matriz</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Copia o desenho atual pra biblioteca de matrizes — fica visível pra todos os
          usuários, que podem arrastá-la pro próprio projeto. Editar ou apagar este projeto
          depois não afeta a matriz já publicada.
        </p>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="template-name">Nome no catálogo</Label>
          <Input
            id="template-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={200}
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={publishing}>Cancelar</Button>
          <Button onClick={() => void handlePublish()} disabled={publishing || !name.trim()}>
            {publishing ? "Publicando…" : "Publicar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
