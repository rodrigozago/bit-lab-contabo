import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { EmbroideryProject } from "@ponto-studio/shared";
import { useProjectStore } from "./projectStore.ts";

function makeProject(): EmbroideryProject {
  return {
    id: "proj-1",
    name: "Teste",
    canvas: { widthMm: 100, heightMm: 100 },
    elements: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useProjectStore", () => {
  it("addElement adiciona elemento e o seleciona", () => {
    const { result } = renderHook(() => useProjectStore(makeProject()));

    let id = "";
    act(() => {
      id = result.current.addElement("M 0 0 Z", "#7c5cbf");
    });

    expect(result.current.project.elements).toHaveLength(1);
    expect(result.current.selectedElement?.id).toBe(id);
    expect(result.current.selectedElement?.color).toBe("#7c5cbf");
    expect(result.current.selectedElement?.stitch.type).toBe("tatami");
  });

  it("addElement com svgContent guarda o SVG completo", () => {
    const { result } = renderHook(() => useProjectStore(makeProject()));

    act(() => {
      result.current.addElement("M 0 0 Z", "#000", "<svg></svg>");
    });

    expect(result.current.project.elements[0].svgContent).toBe("<svg></svg>");
  });

  it("addElement guarda name/groupId/groupName quando passados", () => {
    const { result } = renderHook(() => useProjectStore(makeProject()));

    act(() => {
      result.current.addElement("M 0 0 Z", "#000", undefined, {
        name: "Contorno",
        groupId: "grp-1",
        groupName: "logo.png",
      });
    });

    const el = result.current.project.elements[0];
    expect(el.name).toBe("Contorno");
    expect(el.groupId).toBe("grp-1");
    expect(el.groupName).toBe("logo.png");
    expect(el.hidden).toBeUndefined();
  });

  it("toggleElementHidden alterna e persiste a visibilidade da parte", () => {
    const { result } = renderHook(() => useProjectStore(makeProject()));

    let id = "";
    act(() => {
      id = result.current.addElement("M 0 0 Z", "#000");
    });
    expect(result.current.project.elements[0].hidden).toBeFalsy();

    act(() => {
      result.current.toggleElementHidden(id);
    });
    expect(result.current.project.elements[0].hidden).toBe(true);

    act(() => {
      result.current.toggleElementHidden(id);
    });
    expect(result.current.project.elements[0].hidden).toBe(false);
  });

  it("updateElement aplica name (renomear parte)", () => {
    const { result } = renderHook(() => useProjectStore(makeProject()));

    let id = "";
    act(() => {
      id = result.current.addElement("M 0 0 Z", "#000");
    });
    act(() => {
      result.current.updateElement(id, { name: "Pétalas" });
    });

    expect(result.current.project.elements[0].name).toBe("Pétalas");
  });

  it("updateElement aplica patch parcial", () => {
    const { result } = renderHook(() => useProjectStore(makeProject()));

    let id = "";
    act(() => {
      id = result.current.addElement("M 0 0 Z", "#000");
    });
    act(() => {
      result.current.updateElement(id, { color: "#ff0000" });
    });

    expect(result.current.project.elements[0].color).toBe("#ff0000");
    expect(result.current.project.elements[0].svgPath).toBe("M 0 0 Z");
  });

  it("removeElement remove e limpa a seleção", () => {
    const { result } = renderHook(() => useProjectStore(makeProject()));

    let id = "";
    act(() => {
      id = result.current.addElement("M 0 0 Z", "#000");
    });
    act(() => {
      result.current.removeElement(id);
    });

    expect(result.current.project.elements).toHaveLength(0);
    expect(result.current.selectedElement).toBeNull();
  });

  it("removeElement com id inexistente não altera nada", () => {
    const { result } = renderHook(() => useProjectStore(makeProject()));

    act(() => {
      result.current.addElement("M 0 0 Z", "#000");
    });
    act(() => {
      result.current.removeElement("nao-existe");
    });

    expect(result.current.project.elements).toHaveLength(1);
  });

  it("sincroniza com onSync após debounce de 600ms", () => {
    const onSync = vi.fn();
    const { result } = renderHook(() => useProjectStore(makeProject(), onSync));

    act(() => {
      result.current.addElement("M 0 0 Z", "#000");
    });
    expect(onSync).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(onSync).toHaveBeenCalledTimes(1);
    expect(onSync.mock.calls[0][0].elements).toHaveLength(1);
  });

  it("mutações em sequência dentro do debounce geram um único sync", () => {
    const onSync = vi.fn();
    const { result } = renderHook(() => useProjectStore(makeProject(), onSync));

    let id = "";
    act(() => {
      id = result.current.addElement("M 0 0 Z", "#000");
    });
    act(() => {
      vi.advanceTimersByTime(300);
      result.current.updateElement(id, { color: "#00ff00" });
    });
    act(() => {
      vi.advanceTimersByTime(600);
    });

    expect(onSync).toHaveBeenCalledTimes(1);
    expect(onSync.mock.calls[0][0].elements[0].color).toBe("#00ff00");
  });

  it("saveStatus começa idle e vai pra saved quando onSync resolve", async () => {
    const onSync = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useProjectStore(makeProject(), onSync));

    expect(result.current.saveStatus).toBe("idle");

    act(() => {
      result.current.addElement("M 0 0 Z", "#000");
    });

    await act(async () => {
      vi.advanceTimersByTime(600);
      await Promise.resolve();
    });

    expect(result.current.saveStatus).toBe("saved");
  });

  it("saveStatus vai pra error quando onSync rejeita", async () => {
    const onSync = vi.fn().mockRejectedValue(new Error("network"));
    const { result } = renderHook(() => useProjectStore(makeProject(), onSync));

    act(() => {
      result.current.addElement("M 0 0 Z", "#000");
    });

    await act(async () => {
      vi.advanceTimersByTime(600);
      await Promise.resolve();
    });

    expect(result.current.saveStatus).toBe("error");
  });

  it("retrySync tenta salvar de novo com o estado atual do projeto", async () => {
    const onSync = vi.fn()
      .mockRejectedValueOnce(new Error("net"))
      .mockResolvedValueOnce(undefined);
    const { result } = renderHook(() => useProjectStore(makeProject(), onSync));

    act(() => {
      result.current.addElement("M 0 0 Z", "#000");
    });
    await act(async () => {
      vi.advanceTimersByTime(600);
      await Promise.resolve();
    });
    expect(result.current.saveStatus).toBe("error");

    await act(async () => {
      result.current.retrySync();
      await Promise.resolve();
    });

    expect(result.current.saveStatus).toBe("saved");
    expect(onSync).toHaveBeenCalledTimes(2);
  });

  it("splitElement troca o elemento por N clones NA MESMA posição (ordem de costura preservada)", () => {
    const { result } = renderHook(() => useProjectStore(makeProject()));

    let before = "", middle = "", after = "";
    act(() => {
      before = result.current.addElement("M 0 0 Z", "#111111");
      middle = result.current.addElement("M 0 0 Z", "#ff0000", "<svg>2 regioes</svg>", { name: "Coração" });
      after = result.current.addElement("M 0 0 Z", "#222222");
    });

    let newIds: string[] = [];
    act(() => {
      newIds = result.current.splitElement(middle, ["<svg>r1</svg>", "<svg>r2</svg>"]);
    });

    expect(newIds).toHaveLength(2);
    const ids = result.current.project.elements.map((e) => e.id);
    // clones ocupam a posição do original, entre before e after
    expect(ids).toEqual([before, newIds[0], newIds[1], after]);
    const [r1, r2] = newIds.map((id) => result.current.project.elements.find((e) => e.id === id)!);
    expect(r1.name).toBe("Coração 1");
    expect(r2.name).toBe("Coração 2");
    expect(r1.color).toBe("#ff0000"); // cor/ponto herdados do original
    expect(r1.svgContent).toBe("<svg>r1</svg>");
    expect(r2.svgContent).toBe("<svg>r2</svg>");
    // a primeira região fica selecionada
    expect(result.current.selectedElement?.id).toBe(newIds[0]);
  });

  it("splitElement sem nome usa \"Região 1..N\" e ignora chamadas com <2 regiões", () => {
    const { result } = renderHook(() => useProjectStore(makeProject()));

    let id = "";
    act(() => {
      id = result.current.addElement("M 0 0 Z", "#000", "<svg></svg>");
    });

    let noop: string[] = ["sentinela"];
    act(() => {
      noop = result.current.splitElement(id, ["<svg>única</svg>"]);
    });
    expect(noop).toEqual([]);
    expect(result.current.project.elements).toHaveLength(1);

    act(() => {
      result.current.splitElement(id, ["<svg>a</svg>", "<svg>b</svg>", "<svg>c</svg>"]);
    });
    expect(result.current.project.elements.map((e) => e.name)).toEqual(["Região 1", "Região 2", "Região 3"]);
  });
});
