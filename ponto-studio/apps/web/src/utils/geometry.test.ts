import { describe, it, expect } from "vitest";
import { rectToSvgPath, parseSvgPathBounds, shapeGeometryToSvgPath, svgPathToPoints } from "./geometry.ts";
import type { Editor as TldrawEditor, TLShape } from "@tldraw/tldraw";

/** Mock mínimo de editor.getShapeGeometry(shape) — só o que shapeGeometryToSvgPath usa. */
function mockEditor(geometry: { bounds: { x: number; y: number; w: number; h: number }; toSimpleSvgPath: () => string }) {
  return { getShapeGeometry: () => geometry } as unknown as TldrawEditor;
}

describe("rectToSvgPath", () => {
  it("gera um path fechado com os quatro cantos do retângulo", () => {
    expect(rectToSvgPath(0, 0, 100, 50)).toBe("M 0 0 L 100 0 L 100 50 L 0 50 Z");
  });

  it("aceita origem deslocada", () => {
    expect(rectToSvgPath(10, 20, 30, 40)).toBe("M 10 20 L 40 20 L 40 60 L 10 60 Z");
  });

  it("arredonda coordenadas para 2 casas decimais", () => {
    expect(rectToSvgPath(0.12345, 0.6789, 1.11111, 2.22222)).toBe(
      "M 0.12 0.68 L 1.23 0.68 L 1.23 2.9 L 0.12 2.9 Z"
    );
  });
});

describe("parseSvgPathBounds", () => {
  it("faz round-trip com rectToSvgPath (posição + tamanho)", () => {
    expect(parseSvgPathBounds(rectToSvgPath(40, 60, 120, 80))).toEqual({ x: 40, y: 60, w: 120, h: 80 });
    expect(parseSvgPathBounds(rectToSvgPath(0, 0, 100, 50))).toEqual({ x: 0, y: 0, w: 100, h: 50 });
  });

  it("null pra svgPath ausente, com menos de 2 pontos, ou degenerado", () => {
    expect(parseSvgPathBounds(undefined)).toBeNull();
    expect(parseSvgPathBounds("M 0 0")).toBeNull(); // só 1 ponto
    expect(parseSvgPathBounds("M 5 5 L 5 5 L 5 5 L 5 5 Z")).toBeNull(); // largura/altura 0
  });

  it("lê o retângulo mesmo com cantos em ordem diferente (usa min/max)", () => {
    // um path que fecha no sentido anti-horário ainda tem os mesmos extremos
    expect(parseSvgPathBounds("M 10 20 L 10 60 L 40 60 L 40 20 Z")).toEqual({ x: 10, y: 20, w: 30, h: 40 });
  });

  it("lê o bounding box de um polígono arbitrário (não-retangular)", () => {
    // triângulo: 3 pontos, não 4 — precisa funcionar com qualquer nº de pares
    expect(parseSvgPathBounds("M 10 10 L 50 10 L 30 40 Z")).toEqual({ x: 10, y: 10, w: 40, h: 30 });
  });

  it("lê o bounding box de uma elipse poligonalizada (muitos pontos)", () => {
    const points = Array.from({ length: 32 }, (_, i) => {
      const t = (i / 32) * 2 * Math.PI;
      const x = 50 + 40 * Math.cos(t);
      const y = 60 + 25 * Math.sin(t);
      return `L ${x.toFixed(2)} ${y.toFixed(2)}`;
    });
    const d = `M ${points[0]!.slice(2)} ${points.slice(1).join(" ")} Z`;
    const bounds = parseSvgPathBounds(d)!;
    expect(bounds.x).toBeCloseTo(10, 0);
    expect(bounds.y).toBeCloseTo(35, 0);
    expect(bounds.w).toBeCloseTo(80, 0);
    expect(bounds.h).toBeCloseTo(50, 0);
  });
});

describe("shapeGeometryToSvgPath", () => {
  it("traduz a geometria local (M/L/Z, separada por vírgula) pro centro pedido", () => {
    // geometria local de um triângulo com bounds [0,0,20,10] (centro local em 10,5)
    const editor = mockEditor({
      bounds: { x: 0, y: 0, w: 20, h: 10 },
      toSimpleSvgPath: () => "M0,0L20,0L10,10Z",
    });
    const shape = {} as TLShape;
    // reposiciona o centro local (10,5) pro centro pedido (110,55) → desloca (+100,+50)
    const d = shapeGeometryToSvgPath(editor, shape, { x: 110, y: 55 });
    expect(d).toBe("M 100 50 L 120 50 L 110 60 Z");
  });

  it("não fecha o path se a geometria local não for fechada (traço livre aberto)", () => {
    const editor = mockEditor({
      bounds: { x: 0, y: 0, w: 10, h: 10 },
      toSimpleSvgPath: () => "M0,0L10,10", // sem Z — Polyline2d/draw aberto
    });
    const shape = {} as TLShape;
    const d = shapeGeometryToSvgPath(editor, shape, { x: 0, y: 0 });
    expect(d).toBe("M -5 -5 L 5 5");
  });

  it("null pra geometria degenerada (largura ou altura zero)", () => {
    const editor = mockEditor({
      bounds: { x: 0, y: 0, w: 0, h: 10 },
      toSimpleSvgPath: () => "M0,0L0,10Z",
    });
    const shape = {} as TLShape;
    expect(shapeGeometryToSvgPath(editor, shape, { x: 0, y: 0 })).toBeNull();
  });
});

describe("svgPathToPoints", () => {
  it("extrai os pontos em ordem de um path M/L/Z", () => {
    expect(svgPathToPoints("M 10 20 L 30 40 L 50 60 Z")).toEqual([
      { x: 10, y: 20 },
      { x: 30, y: 40 },
      { x: 50, y: 60 },
    ]);
  });

  it("faz round-trip com rectToSvgPath (4 cantos, em ordem)", () => {
    expect(svgPathToPoints(rectToSvgPath(0, 0, 100, 50))).toEqual([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 50 },
      { x: 0, y: 50 },
    ]);
  });

  it("null pra svgPath ausente ou com menos de 3 pontos", () => {
    expect(svgPathToPoints(undefined)).toBeNull();
    expect(svgPathToPoints("M 10 20 L 30 40 Z")).toBeNull(); // só 2 pontos
  });
});
