import { describe, it, expect } from "vitest";
import {
  parseViewBoxDimensions,
  computeContainTransform,
  scalePathData,
} from "./svgTransform.js";

describe("parseViewBoxDimensions", () => {
  it("lê width/height do viewBox", () => {
    expect(parseViewBoxDimensions(`<svg viewBox="0 0 200 150">`)).toEqual({ width: 200, height: 150 });
  });

  it("aceita viewBox com minX/minY não-zero", () => {
    expect(parseViewBoxDimensions(`<svg viewBox="-10 -5 200 150">`)).toEqual({ width: 200, height: 150 });
  });

  it("usa width/height quando não há viewBox", () => {
    expect(parseViewBoxDimensions(`<svg width="80" height="60">`)).toEqual({ width: 80, height: 60 });
  });

  it("prioriza viewBox sobre width/height quando ambos presentes", () => {
    expect(parseViewBoxDimensions(`<svg width="999" height="999" viewBox="0 0 200 150">`)).toEqual({
      width: 200, height: 150,
    });
  });

  it("retorna null quando não há svg, viewBox nem width/height", () => {
    expect(parseViewBoxDimensions(`<rect width="5" height="5"/>`)).toBeNull();
    expect(parseViewBoxDimensions(`<svg>`)).toBeNull();
  });
});

describe("computeContainTransform", () => {
  it("replica o bug real: viewBox 200x200 → canvas 100x100mm", () => {
    const t = computeContainTransform({ width: 200, height: 200 }, { width: 100, height: 100 });
    expect(t.scale).toBe(0.5);
    expect(t.offsetX).toBe(0);
    expect(t.offsetY).toBe(0);
  });

  it("usa a menor escala (contain-fit) e centraliza quando a proporção difere", () => {
    // fonte 200x100 (2:1) em canvas 100x100 (1:1) → escala limitada pela largura
    const t = computeContainTransform({ width: 200, height: 100 }, { width: 100, height: 100 });
    expect(t.scale).toBe(0.5);
    expect(t.offsetX).toBe(0);
    expect(t.offsetY).toBe(25); // (100 - 100*0.5) / 2
  });
});

describe("scalePathData", () => {
  it("escala e desloca coordenadas absolutas (M/L)", () => {
    expect(scalePathData("M 0 0 L 200 0 L 200 200 L 0 200 Z", 0.5, 10, 5)).toBe(
      "M 10 5 L 110 5 L 110 105 L 10 105 Z"
    );
  });

  it("não desloca deltas de comandos relativos, só escala (mesmo o m inicial)", () => {
    // Simplificação aceita: só M/L/C/... maiúsculos recebem offset. Um "m"
    // minúsculo como primeiro comando do path (tecnicamente absoluto na spec
    // SVG) não ocorre na prática — a IA sempre gera "M" maiúsculo inicial.
    expect(scalePathData("m 10 10 l 20 0 l 0 20 z", 0.5, 100, 50)).toBe(
      "m 5 5 l 10 0 l 0 10 z"
    );
  });

  it("escala curvas C (todos os pontos de controle e o ponto final)", () => {
    const result = scalePathData("M100 170 C91 160 72 143 58 124", 0.5, 0, 0);
    expect(result).toBe("M 50 85 C 45.5 80 36 71.5 29 62");
  });

  it("trata H e V isoladamente (apenas o eixo correspondente)", () => {
    expect(scalePathData("M 10 10 H 50 V 90 H 10 Z", 0.5, 10, 10)).toBe(
      "M 15 15 H 35 V 55 H 15 Z"
    );
  });

  it("suporta repetição implícita de comando (múltiplos pares sem repetir a letra)", () => {
    expect(scalePathData("M 0 0 L 10 0 20 0 30 0", 2, 0, 0)).toBe(
      "M 0 0 L 20 0 40 0 60 0"
    );
  });

  it("mantém rotação e flags de arco (A) intocados, escala raios e ponto final", () => {
    expect(scalePathData("M 0 0 A 30 50 45 1 0 100 100", 0.5, 5, 5)).toBe(
      "M 5 5 A 15 25 45 1 0 55 55"
    );
  });
});
