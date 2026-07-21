import { describe, it, expect } from "vitest";
import {
  parseViewBoxDimensions,
  computeContainTransform,
  scalePathData,
  rotatePathData,
  flattenPathData,
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

describe("rotatePathData", () => {
  it("sem rotação (0°), devolve o d original intocado", () => {
    expect(rotatePathData("M 0 0 L 10 0 L 10 10 Z", 0, 5, 5)).toBe("M 0 0 L 10 0 L 10 10 Z");
    // 360° é equivalente a 0°
    expect(rotatePathData("M 0 0 L 10 0", 360, 5, 5)).toBe("M 0 0 L 10 0");
  });

  it("rotaciona um triângulo 90° em torno do seu centro", () => {
    // triângulo M(0,0) L(10,0) L(10,10), centro (5,5) — rotação 90° leva
    // cada vértice pro próximo (sentido consistente com svgpathtools.rotated:
    // x' = cx + dx·cos − dy·sin, y' = cy + dx·sin + dy·cos)
    expect(rotatePathData("M 0 0 L 10 0 L 10 10 Z", 90, 5, 5)).toBe(
      "M 10 0 L 10 10 L 0 10 Z"
    );
  });

  it("H e V viram L (rotação não preserva linha horizontal/vertical)", () => {
    // M(0,0) H10 → segmento horizontal (0,0)-(10,0); rotacionado 90° em torno
    // da origem vira segmento vertical (0,0)-(0,10)
    expect(rotatePathData("M 0 0 H 10", 90, 0, 0)).toBe("M 0 0 L 0 10");
    expect(rotatePathData("M 0 0 V 10", 90, 0, 0)).toBe("M 0 0 L -10 0");
  });

  it("comandos relativos (minúsculos) são convertidos e rotacionados corretamente", () => {
    // m(10,10) l(5,0): segmento horizontal de comprimento 5 a partir de (10,10)
    // rotacionado 90° em torno da origem — vira um segmento VERTICAL
    const result = rotatePathData("m 10 10 l 5 0", 90, 0, 0);
    expect(result).toBe("M -10 10 L -10 15");
  });

  it("M com pares extras trata os extras como LINETO implícito", () => {
    // M(0,0) seguido de (10,0) sem repetir a letra — o 2º par é um L implícito
    expect(rotatePathData("M 0 0 10 0", 90, 0, 0)).toBe("M 0 0 L 0 10");
  });

  it("curva C: todos os pontos de controle e o final rotacionam junto", () => {
    // segmento reto pra facilitar conferência manual: C com pontos colineares
    const result = rotatePathData("M 0 0 C 10 0 20 0 30 0", 90, 0, 0);
    expect(result).toBe("M 0 0 C 0 10 0 20 0 30");
  });

  it("Z fecha de volta ao ponto de início (já rotacionado) e reseta o estado interno", () => {
    // depois do Z, um comando relativo deve calcular a partir do INÍCIO do
    // subpath (0,0 original), não do último ponto antes do Z
    const result = rotatePathData("M 0 0 L 10 0 Z l 0 5", 90, 0, 0);
    // M(0,0)->(0,0); L(10,0)->(0,10); Z fecha; l(0,5) relativo ao (0,0)
    // original -> ponto absoluto (0,5) -> rotacionado (-5,0)
    expect(result).toBe("M 0 0 L 0 10 Z L -5 0");
  });

  it("arco (A): ponto final rotaciona e x-axis-rotation soma o ângulo; raios e flags intocados", () => {
    expect(rotatePathData("M 0 0 A 30 50 45 1 0 100 100", 90, 0, 0)).toBe(
      "M 0 0 A 30 50 135 1 0 -100 100"
    );
  });

  it("rotação em torno de um centro não-origem desloca corretamente", () => {
    // ponto (10,10) rotacionado 180° em torno de (5,5) deve virar (0,0)
    expect(rotatePathData("M 10 10", 180, 5, 5)).toBe("M 0 0");
  });
});

describe("flattenPathData", () => {
  it("retângulo (M/L/Z) vira 1 subcaminho com os 4 vértices + fechamento no início", () => {
    const result = flattenPathData("M 0 0 L 10 0 L 10 5 L 0 5 Z");
    expect(result).toEqual([[[0, 0], [10, 0], [10, 5], [0, 5], [0, 0]]]);
  });

  it("dois M sem Z viram 2 subcaminhos separados", () => {
    const result = flattenPathData("M 0 0 L 10 0 M 0 5 L 10 5");
    expect(result).toEqual([[[0, 0], [10, 0]], [[0, 5], [10, 5]]]);
  });

  it("H/V viram pontos no eixo certo", () => {
    const result = flattenPathData("M 0 0 H 10 V 5");
    expect(result).toEqual([[[0, 0], [10, 0], [10, 5]]]);
  });

  it("M com pares extras (LINETO implícito) vira pontos extra no mesmo subcaminho", () => {
    const result = flattenPathData("M 0 0 5 0 10 0");
    expect(result).toEqual([[[0, 0], [5, 0], [10, 0]]]);
  });

  it("curva cúbica (C) é subdividida com resolução fixa e o ponto médio bate com a fórmula de Bézier", () => {
    // M 0,0 C 0,10 10,10 10,0 — "corcova" simétrica; t=0.5 -> (5, 7.5) (fórmula cúbica exata)
    const [subpath] = flattenPathData("M 0 0 C 0 10 10 10 10 0", 16);
    expect(subpath).toHaveLength(1 + 16); // ponto do M + 16 amostras da curva
    expect(subpath![0]).toEqual([0, 0]); // ponto inicial (do M)
    expect(subpath![subpath!.length - 1]).toEqual([10, 0]); // ponto final da curva
    const midpoint = subpath![1 + 8 - 1]!; // amostra s=8 de 16 -> t=0.5
    expect(midpoint[0]).toBeCloseTo(5, 6);
    expect(midpoint[1]).toBeCloseTo(7.5, 6);
  });

  it("curva quadrática (Q) começa e termina nos pontos certos", () => {
    const [subpath] = flattenPathData("M 0 0 Q 5 10 10 0", 10);
    expect(subpath![0]).toEqual([0, 0]);
    expect(subpath![subpath!.length - 1]![0]).toBeCloseTo(10, 6);
    expect(subpath![subpath!.length - 1]![1]).toBeCloseTo(0, 6);
    // ponto médio (t=0.5) de uma quadrática simétrica fica na metade da altura do controle: y=5
    const midpoint = subpath![1 + 5 - 1]!;
    expect(midpoint[1]).toBeCloseTo(5, 6);
  });

  it("S (cúbica suave) reflete o 2º ponto de controle da curva anterior — confere contra a fórmula de Bézier", () => {
    // C: (0,0)->(10,10), ctrl1=(0,10) ctrl2=(5,10). S reflete ctrl2 em torno do ponto atual (10,10):
    // c1 = 2*(10,10) - (5,10) = (15,10). Cúbica S: P0=(10,10) C1=(15,10) C2=(20,20) P3=(20,0).
    // Ponto médio (t=0.5) por substituição direta na fórmula: (16.875, 12.5).
    const [subpath] = flattenPathData("M 0 0 C 0 10 5 10 10 10 S 20 20 20 0", 20);
    const sMidpoint = subpath![1 + 20 + 10 - 1]!; // 1 (M) + 20 (C) + amostra s=10/20 (t=0.5) do S
    expect(sMidpoint[0]).toBeCloseTo(16.875, 6);
    expect(sMidpoint[1]).toBeCloseTo(12.5, 6);
  });

  it("comandos relativos (l/c minúsculos) são convertidos pra absoluto corretamente", () => {
    // l 10,0 a partir de (5,5) -> (15,5); c relativo soma tudo a partir do ponto ANTES do comando
    const result = flattenPathData("M 5 5 l 10 0 c 0 5 5 5 5 0", 4);
    const subpath = result[0]!;
    expect(subpath[0]).toEqual([5, 5]);
    expect(subpath[1]).toEqual([15, 5]); // ponto final do "l"
    expect(subpath[subpath.length - 1]![0]).toBeCloseTo(20, 6); // 15+5 (ponto final do "c")
    expect(subpath[subpath.length - 1]![1]).toBeCloseTo(5, 6);
  });

  it("arco (A) de meio-círculo aproxima pontos no raio esperado", () => {
    // meio-círculo de raio 5 entre (-5,0) e (5,0), sweep=1 -> passa por (0,5) no meio
    const [subpath] = flattenPathData("M -5 0 A 5 5 0 0 1 5 0", 20);
    const midpoint = subpath![10]!; // amostra do meio (s=10 de 20 -> t=0.5)
    expect(Math.hypot(midpoint[0], midpoint[1])).toBeCloseTo(5, 3); // raio ~5 (ponto sobre o círculo certo)
    expect(midpoint[0]).toBeCloseTo(0, 3); // no meio do arco, x fica ~0 (equidistante das pontas)
    expect(Math.abs(midpoint[1])).toBeGreaterThan(4); // desvia bastante da corda reta (y=0)
  });
});
