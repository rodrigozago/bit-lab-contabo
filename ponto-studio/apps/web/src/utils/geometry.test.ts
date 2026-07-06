import { describe, it, expect } from "vitest";
import { rectToSvgPath } from "./geometry.ts";

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
