import { describe, it, expect } from "vitest";
import type { AnalyzeLayerMetrics, AnalyzeMetrics } from "@ponto-studio/shared";
import {
  suggestStitchParams,
  findLayerMetrics,
  DEFAULT_STITCH,
} from "./stitchHeuristics.ts";

// imagem analisada de 400×400px representando um desenho de 100×100mm → 4 px/mm
const PX_PER_MM = 4;
const IMAGE = { imageWidth: 400, imageHeight: 400 };

function layer(overrides: Partial<AnalyzeLayerMetrics>): AnalyzeLayerMetrics {
  return {
    color: "#ff0000",
    areaPct: 10,
    meanWidthPx: 40,
    maxWidthPx: 60,
    regionCount: 1,
    principalAngleDeg: 0,
    elongation: 1.2,
    ...overrides,
  };
}

describe("suggestStitchParams", () => {
  it("traço fino (< 1.2mm) vira ponto corrido", () => {
    // 3px / 4px por mm = 0.75mm de largura
    const s = suggestStitchParams(layer({ meanWidthPx: 3 }), IMAGE, PX_PER_MM, 0);
    expect(s.type).toBe("running");
  });

  it("coluna fina e alongada vira cetim com ângulo perpendicular ao eixo", () => {
    // 16px/4 = 4mm de largura, alongada (elongation 5), eixo a 30°
    const s = suggestStitchParams(
      layer({ meanWidthPx: 16, elongation: 5, principalAngleDeg: 30 }),
      IMAGE, PX_PER_MM, 0
    );
    expect(s.type).toBe("satin");
    expect(s.angle).toBe(120); // 30 + 90
    expect(s.underlay).toBe(true); // 4mm > 3mm
    expect(s.pullCompensationMm).toBeGreaterThan(0);
  });

  it("cetim estreito (< 3mm) não pede underlay", () => {
    const s = suggestStitchParams(
      layer({ meanWidthPx: 8, elongation: 5 }), // 2mm
      IMAGE, PX_PER_MM, 0
    );
    expect(s.type).toBe("satin");
    expect(s.underlay).toBeUndefined();
  });

  it("área grande vira tatami com underlay e ângulo alternando por camada", () => {
    // 40px/4 = 10mm de largura (> 8mm → não é coluna), 30% de 100×100mm = 3000mm²
    const m = layer({ meanWidthPx: 40, areaPct: 30, elongation: 1.5 });
    const s0 = suggestStitchParams(m, IMAGE, PX_PER_MM, 0);
    const s1 = suggestStitchParams(m, IMAGE, PX_PER_MM, 1);
    expect(s0.type).toBe("tatami");
    expect(s0.underlay).toBe(true); // 3000mm² > 100mm²
    expect(s0.angle).toBe(45);
    expect(s1.angle).toBe(135);
  });

  it("área pequena vira tatami sem underlay", () => {
    // 0.5% de 100×100mm = 50mm² < 100mm²
    const s = suggestStitchParams(
      layer({ meanWidthPx: 40, areaPct: 0.5, elongation: 1.5 }),
      IMAGE, PX_PER_MM, 0
    );
    expect(s.type).toBe("tatami");
    expect(s.underlay).toBeUndefined();
  });

  it("sem métricas devolve o default", () => {
    expect(suggestStitchParams(undefined, IMAGE, PX_PER_MM, 0)).toEqual(DEFAULT_STITCH);
    expect(suggestStitchParams(layer({}), undefined, PX_PER_MM, 0)).toEqual(DEFAULT_STITCH);
    expect(suggestStitchParams(layer({}), IMAGE, 0, 0)).toEqual(DEFAULT_STITCH);
  });
});

describe("findLayerMetrics", () => {
  const metrics: AnalyzeMetrics = {
    ...IMAGE,
    layers: [layer({ color: "#ff0000" }), layer({ color: "#0000ee" })],
  };

  it("casa por hex exato (case-insensitive)", () => {
    expect(findLayerMetrics(metrics, "#FF0000")?.color).toBe("#ff0000");
  });

  it("sem match exato, casa pela cor mais próxima", () => {
    expect(findLayerMetrics(metrics, "#0000ff")?.color).toBe("#0000ee");
  });

  it("sem métricas devolve undefined", () => {
    expect(findLayerMetrics(undefined, "#ff0000")).toBeUndefined();
    expect(findLayerMetrics({ ...IMAGE, layers: [] }, "#ff0000")).toBeUndefined();
  });
});
