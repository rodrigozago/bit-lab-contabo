import { useState, useCallback, useEffect, useRef } from "react";
import type { EmbroideryProject, EmbroideryElement, StitchParams } from "@ponto-studio/shared";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

/**
 * Store local do projeto com sync automático para a API (modelo Canva: edita
 * → salva sozinho em background). onSync é chamado com debounce de 600ms após
 * qualquer mutação; saveStatus reflete o resultado pra dar feedback visual.
 */
export function useProjectStore(
  initial: EmbroideryProject,
  onSync?: (p: EmbroideryProject) => Promise<void>
) {
  const [project, setProject] = useState<EmbroideryProject>(initial);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  const selectedElement = project.elements.find((e) => e.id === selectedElementId) ?? null;

  // Debounce do sync para não fazer PUT a cada keystroke
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSyncRef = useRef(onSync);
  useEffect(() => { onSyncRef.current = onSync; }, [onSync]);

  const runSync = useCallback(async (p: EmbroideryProject) => {
    setSaveStatus("saving");
    try {
      await onSyncRef.current?.(p);
      setSaveStatus("saved");
      setLastSavedAt(new Date().toISOString());
      setLastError(null);
    } catch (err) {
      setSaveStatus("error");
      setLastError(err instanceof Error ? err.message : "erro desconhecido");
    }
  }, []);

  function scheduleSync(p: EmbroideryProject) {
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => { void runSync(p); }, 600);
  }

  // Retry manual — clique no indicador "Erro ao salvar" tenta de novo com o estado atual
  const retrySync = useCallback(() => { void runSync(project); }, [project, runSync]);

  const addElement = useCallback((
    svgPath: string,
    color: string,
    svgContent?: string,
    opts?: {
      name?: string;
      groupId?: string;
      groupName?: string;
      /** parâmetros sugeridos pela heurística (stitchHeuristics) — substituem o default */
      stitch?: StitchParams;
      stitchSuggested?: boolean;
    },
  ) => {
    const el: EmbroideryElement = {
      id: crypto.randomUUID(),
      svgPath,
      ...(svgContent ? { svgContent } : {}),
      color,
      // sem sugestão da heurística, tatami é o default: mais fiel pra
      // letras/detalhes que cetim, que exagera bordas em formas com
      // contornos irregulares (STI-2)
      stitch: opts?.stitch ?? { type: "tatami", density: 0.6, angle: 45 },
      ...(opts?.stitchSuggested ? { stitchSuggested: true } : {}),
      ...(opts?.name ? { name: opts.name } : {}),
      ...(opts?.groupId ? { groupId: opts.groupId } : {}),
      ...(opts?.groupName ? { groupName: opts.groupName } : {}),
    };
    setProject((p) => {
      const next = { ...p, elements: [...p.elements, el], updatedAt: new Date().toISOString() };
      scheduleSync(next);
      return next;
    });
    setSelectedElementId(el.id);
    return el.id;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const updateElement = useCallback((id: string, patch: Partial<EmbroideryElement>) => {
    setProject((p) => {
      const next = {
        ...p,
        elements: p.elements.map((e) => (e.id === id ? { ...e, ...patch } : e)),
        updatedAt: new Date().toISOString(),
      };
      scheduleSync(next);
      return next;
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // STI-4: a posição no array É a ordem de costura na máquina (export/preview
  // iteram na ordem) — mover pra cima = costurar antes.
  const moveElement = useCallback((id: string, direction: "up" | "down") => {
    setProject((p) => {
      const idx = p.elements.findIndex((e) => e.id === id);
      const target = direction === "up" ? idx - 1 : idx + 1;
      if (idx === -1 || target < 0 || target >= p.elements.length) return p;
      const elements = [...p.elements];
      [elements[idx], elements[target]] = [elements[target]!, elements[idx]!];
      const next = { ...p, elements, updatedAt: new Date().toISOString() };
      scheduleSync(next);
      return next;
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Visibilidade da parte é persistida (element.hidden) — o Editor reflete no
  // shape vinculado do tldraw. Antes o show/hide vivia só no tldraw e sumia ao
  // recarregar o projeto.
  const toggleElementHidden = useCallback((id: string) => {
    setProject((p) => {
      const next = {
        ...p,
        elements: p.elements.map((e) => (e.id === id ? { ...e, hidden: !e.hidden } : e)),
        updatedAt: new Date().toISOString(),
      };
      scheduleSync(next);
      return next;
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Fase 5 (separação sob demanda): substitui um elemento por N clones, um
   * por região desconectada (`regionSvgs` vem de splitSvgIntoRegions) — mesma
   * cor/ponto/bbox/rotação, nomes "base 1..N", inseridos NA MESMA posição do
   * array (a posição é a ordem de costura na máquina; as regiões continuam
   * costurando no lugar da parte original). Ids são gerados FORA do updater:
   * o StrictMode roda updaters 2x em dev, e efeitos colaterais lá dentro
   * (gerar id, push em array) dobrariam.
   */
  const splitElement = useCallback((id: string, regionSvgs: string[]): string[] => {
    if (regionSvgs.length < 2) return [];
    const newIds = regionSvgs.map(() => crypto.randomUUID());
    setProject((p) => {
      const idx = p.elements.findIndex((e) => e.id === id);
      if (idx === -1) return p;
      const orig = p.elements[idx]!;
      const base = orig.name?.trim() || "Região";
      const clones: EmbroideryElement[] = regionSvgs.map((svgContent, i) => ({
        ...orig,
        id: newIds[i]!,
        svgContent,
        name: `${base} ${i + 1}`,
      }));
      const elements = [...p.elements.slice(0, idx), ...clones, ...p.elements.slice(idx + 1)];
      const next = { ...p, elements, updatedAt: new Date().toISOString() };
      scheduleSync(next);
      return next;
    });
    setSelectedElementId(newIds[0]!);
    return newIds;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const removeElement = useCallback((id: string) => {
    setProject((p) => {
      const next = {
        ...p,
        elements: p.elements.filter((e) => e.id !== id),
        updatedAt: new Date().toISOString(),
      };
      scheduleSync(next);
      return next;
    });
    setSelectedElementId(null);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    project,
    setProject,
    selectedElementId,
    selectedElement,
    setSelectedElementId,
    addElement,
    updateElement,
    moveElement,
    toggleElementHidden,
    splitElement,
    removeElement,
    saveStatus,
    lastSavedAt,
    lastError,
    retrySync,
  };
}
