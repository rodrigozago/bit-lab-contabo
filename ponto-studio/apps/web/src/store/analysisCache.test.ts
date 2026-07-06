import { describe, it, expect, beforeEach } from "vitest";
import {
  getCached,
  saveAnalysis,
  listAnalyses,
  removeAnalysis,
} from "./analysisCache.ts";

const STORAGE_KEY = "ponto-studio:analyses";

function makeFile(name = "gato.png", size = 1024): File {
  return new File([new Uint8Array(size)], name, { type: "image/png" });
}

const SVG = `<svg viewBox="0 0 10 10"><path d="M 0 0 Z"/></svg>`;

beforeEach(() => {
  localStorage.clear();
});

describe("analysisCache", () => {
  it("salva e lista análises (mais recente primeiro)", () => {
    saveAnalysis(makeFile("a.png"), "data:a", SVG);
    saveAnalysis(makeFile("b.png"), "data:b", SVG);

    const list = listAnalyses();
    expect(list).toHaveLength(2);
    expect(list[0].fileName).toBe("b.png");
    expect(list[1].fileName).toBe("a.png");
  });

  it("persiste no localStorage", () => {
    saveAnalysis(makeFile(), "data:x", SVG);
    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed[0].fileName).toBe("gato.png");
    expect(parsed[0].svg).toBe(SVG);
  });

  it("getCached encontra análise pelo mesmo arquivo (nome + tamanho)", () => {
    saveAnalysis(makeFile("logo.png", 500), "data:logo", SVG);
    const hit = getCached(makeFile("logo.png", 500));
    expect(hit).not.toBeNull();
    expect(hit!.svg).toBe(SVG);
  });

  it("getCached retorna null para arquivo desconhecido", () => {
    saveAnalysis(makeFile("logo.png", 500), "data:logo", SVG);
    expect(getCached(makeFile("outro.png", 500))).toBeNull();
    expect(getCached(makeFile("logo.png", 999))).toBeNull();
  });

  it("substitui entrada existente para o mesmo arquivo (sem duplicar)", () => {
    saveAnalysis(makeFile("a.png", 100), "data:v1", "<svg>v1</svg>");
    saveAnalysis(makeFile("a.png", 100), "data:v2", "<svg>v2</svg>");

    const list = listAnalyses();
    expect(list).toHaveLength(1);
    expect(list[0].svg).toBe("<svg>v2</svg>");
  });

  it("limita o cache a 20 entradas, descartando as mais antigas", () => {
    for (let i = 0; i < 25; i++) {
      saveAnalysis(makeFile(`img-${i}.png`, 100 + i), `data:${i}`, SVG);
    }
    const list = listAnalyses();
    expect(list).toHaveLength(20);
    expect(list[0].fileName).toBe("img-24.png");
    expect(list[19].fileName).toBe("img-5.png");
  });

  it("removeAnalysis apaga somente a entrada indicada", () => {
    const kept = saveAnalysis(makeFile("fica.png", 1), "data:1", SVG);
    const removed = saveAnalysis(makeFile("sai.png", 2), "data:2", SVG);

    removeAnalysis(removed.id);

    const list = listAnalyses();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(kept.id);
  });

  it("retorna lista vazia quando o storage está corrompido", () => {
    localStorage.setItem(STORAGE_KEY, "{{{json inválido");
    expect(listAnalyses()).toEqual([]);
  });
});
