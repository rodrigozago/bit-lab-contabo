import { describe, it, expect } from "vitest";
import { rectToSvgPath, parseRectSvgPath } from "./geometry.ts";

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

describe("parseRectSvgPath", () => {
  it("faz round-trip com rectToSvgPath (posição + tamanho)", () => {
    expect(parseRectSvgPath(rectToSvgPath(40, 60, 120, 80))).toEqual({ x: 40, y: 60, w: 120, h: 80 });
    expect(parseRectSvgPath(rectToSvgPath(0, 0, 100, 50))).toEqual({ x: 0, y: 0, w: 100, h: 50 });
  });

  it("null pra svgPath ausente, sem 8 números, ou degenerado", () => {
    expect(parseRectSvgPath(undefined)).toBeNull();
    expect(parseRectSvgPath("M 0 0 L 10 0 Z")).toBeNull(); // só 4 números
    expect(parseRectSvgPath("M 5 5 L 5 5 L 5 5 L 5 5 Z")).toBeNull(); // largura/altura 0
  });

  it("lê o retângulo mesmo com cantos em ordem diferente (usa min/max)", () => {
    // um path que fecha no sentido anti-horário ainda tem os mesmos extremos
    expect(parseRectSvgPath("M 10 20 L 10 60 L 40 60 L 40 20 Z")).toEqual({ x: 10, y: 20, w: 30, h: 40 });
  });
});
