import { describe, it, expect } from "vitest";
import type { AnalyzeLayerMetrics, AnalyzeMetrics, StitchParams } from "@ponto-studio/shared";
import {
  suggestStitchParams,
  findLayerMetrics,
  DEFAULT_STITCH,
} from "./stitchHeuristics.ts";

// helpers de type-narrowing — suggestStitchParams devolve a união StitchParams;
// cada teste já checa `.type` antes, então isso só formaliza pro TS acessar
// os campos específicos daquele tipo (angle/underlay não existem em todos).
function asType<T extends StitchParams["type"]>(s: StitchParams, type: T): Extract<StitchParams, { type: T }> {
  if (s.type !== type) throw new Error(`esperava type="${type}", veio "${s.type}"`);
  return s as Extract<StitchParams, { type: T }>;
}

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

  it("coluna fina e alongada vira tatami com ângulo perpendicular ao eixo (contour/satin real não suportam ângulo direcional)", () => {
    // 16px/4 = 4mm de largura, alongada (elongation 5), eixo a 30°
    const s = suggestStitchParams(
      layer({ meanWidthPx: 16, elongation: 5, principalAngleDeg: 30 }),
      IMAGE, PX_PER_MM, 0
    );
    const tatami = asType(s, "tatami");
    expect(tatami.angle).toBe(120); // 30 + 90
    expect(tatami.underlay).toBe(true); // 4mm > 3mm
  });

  it("coluna estreita (< 3mm) não pede underlay", () => {
    const s = suggestStitchParams(
      layer({ meanWidthPx: 8, elongation: 5 }), // 2mm
      IMAGE, PX_PER_MM, 0
    );
    const tatami = asType(s, "tatami");
    expect(tatami.underlay).toBeUndefined();
  });

  it("forma arredondada de área pequena/média vira circular", () => {
    // baixo alongamento (quase redondo), área moderada (200mm² < 400mm²)
    const s = suggestStitchParams(
      layer({ elongation: 1.1, areaPct: 2 }), // 2% de 100x100mm = 200mm²
      IMAGE, PX_PER_MM, 0
    );
    const circular = asType(s, "circular");
    expect(circular.underlay).toBe(true); // 200mm² > 100mm²
  });

  it("forma arredondada de área bem pequena não pede underlay", () => {
    const s = suggestStitchParams(
      layer({ elongation: 1.1, areaPct: 0.5 }), // 50mm² < 100mm²
      IMAGE, PX_PER_MM, 0
    );
    const circular = asType(s, "circular");
    expect(circular.underlay).toBeUndefined();
  });

  it("forma arredondada de área GRANDE não vira circular (cai pro tatami)", () => {
    const s = suggestStitchParams(
      layer({ elongation: 1.1, areaPct: 10 }), // 1000mm² > 400mm² (MAX_ROUND_AREA_MM2)
      IMAGE, PX_PER_MM, 0
    );
    expect(s.type).toBe("tatami");
  });

  it("área grande vira tatami com underlay e ângulo alternando por camada", () => {
    // 40px/4 = 10mm de largura (> 8mm → não é coluna), 30% de 100×100mm = 3000mm²
    const m = layer({ meanWidthPx: 40, areaPct: 30, elongation: 1.5 });
    const tatami0 = asType(suggestStitchParams(m, IMAGE, PX_PER_MM, 0), "tatami");
    const tatami1 = asType(suggestStitchParams(m, IMAGE, PX_PER_MM, 1), "tatami");
    expect(tatami0.underlay).toBe(true); // 3000mm² > 100mm²
    expect(tatami0.angle).toBe(45);
    expect(tatami1.angle).toBe(135);
  });

  it("área pequena vira tatami sem underlay", () => {
    // 0.5% de 100×100mm = 50mm² < 100mm²
    const s = suggestStitchParams(
      layer({ meanWidthPx: 40, areaPct: 0.5, elongation: 1.5 }),
      IMAGE, PX_PER_MM, 0
    );
    const tatami = asType(s, "tatami");
    expect(tatami.underlay).toBeUndefined();
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
