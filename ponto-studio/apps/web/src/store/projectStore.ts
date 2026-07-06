import { useState, useCallback, useEffect, useRef } from "react";
import type { EmbroideryProject, EmbroideryElement } from "@ponto-studio/shared";

/**
 * Store local do projeto com sync automático para a API.
 * onSync é chamado com debounce de 600ms após qualquer mutação.
 */
export function useProjectStore(
  initial: EmbroideryProject,
  onSync?: (p: EmbroideryProject) => void
) {
  const [project, setProject] = useState<EmbroideryProject>(initial);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);

  const selectedElement = project.elements.find((e) => e.id === selectedElementId) ?? null;

  // Debounce do sync para não fazer PUT a cada keystroke
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSyncRef = useRef(onSync);
  useEffect(() => { onSyncRef.current = onSync; }, [onSync]);

  function scheduleSync(p: EmbroideryProject) {
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => {
      onSyncRef.current?.(p);
    }, 600);
  }

  const addElement = useCallback((svgPath: string, color: string, svgContent?: string) => {
    const el: EmbroideryElement = {
      id: crypto.randomUUID(),
      svgPath,
      ...(svgContent ? { svgContent } : {}),
      color,
      stitch: { type: "satin", density: 0.6, angle: 45 },
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
    removeElement,
  };
}
