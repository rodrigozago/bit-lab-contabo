import { describe, it, expect } from "vitest";
import { extractSatinRails, type Point } from "./satinRails.js";

function dist(a: Point, b: Point): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

describe("extractSatinRails", () => {
  it("coluna reta com pontos extras nos lados longos (\"escada\") extrai 2 trilhos correspondentes", () => {
    // retângulo 40x10 com pontos intermediários nos lados compridos (não só
    // os 4 cantos) — os 2 cantos de cada ponta EMPATAM na projeção axial e
    // precisam ser colapsados num só ponto (ver collapseTiedEnds)
    const polygon: Point[] = [
      [0, 0], [10, 0], [20, 0], [30, 0], [40, 0], // topo, esquerda -> direita
      [40, 10], [30, 10], [20, 10], [10, 10], [0, 10], // base, direita -> esquerda
    ];
    const rails = extractSatinRails(polygon);
    expect(rails).not.toBeNull();
    const { rail1, rail2 } = rails!;
    expect(rail1.length).toBe(rail2.length);
    expect(rail1.length).toBeGreaterThanOrEqual(3);
    // as 2 pontas ficam no meio de cada lado curto (x=0 e x=40, y=5) — os 2
    // trilhos começam/terminam pertinho uma da outra (mesma direção)
    expect(dist(rail1[0]!, rail2[0]!)).toBeLessThan(1);
    expect(dist(rail1[rail1.length - 1]!, rail2[rail2.length - 1]!)).toBeLessThan(1);
    const startsNearLeft = Math.min(rail1[0]![0], rail2[0]![0]) < 5;
    expect(startsNearLeft).toBe(true);
  });

  it("forma com ponta única (tipo pétala/folha) extrai 2 trilhos que se encontram nas 2 pontas", () => {
    // hexágono alongado: pontas únicas em (0,5) e (40,5), sem empate
    const polygon: Point[] = [
      [0, 5], [10, 0], [30, 0], [40, 5], [30, 10], [10, 10],
    ];
    const rails = extractSatinRails(polygon);
    expect(rails).not.toBeNull();
    const { rail1, rail2 } = rails!;
    expect(rail1.length).toBe(rail2.length);
    expect(dist(rail1[0]!, rail2[0]!)).toBeLessThan(1);
    expect(dist(rail1[rail1.length - 1]!, rail2[rail2.length - 1]!)).toBeLessThan(1);
    // as pontas encontradas devem estar perto de (0,5) e (40,5) (nas 2 extremidades)
    const ends = [rail1[0]!, rail1[rail1.length - 1]!];
    const xs = ends.map((p) => p[0]).sort((a, b) => a - b);
    expect(xs[0]).toBeCloseTo(0, 0);
    expect(xs[1]).toBeCloseTo(40, 0);
  });

  it("forma pouco alongada (quase redonda) não vira cetim — devolve null", () => {
    // octógono ~circular, alongamento baixo
    const polygon: Point[] = [
      [10, 0], [20, 3], [23, 10], [20, 17], [10, 20], [0, 17], [-3, 10], [0, 3],
    ];
    expect(extractSatinRails(polygon)).toBeNull();
  });

  it("polígono com poucos pontos (< 4) devolve null", () => {
    expect(extractSatinRails([[0, 0], [10, 0], [5, 10]])).toBeNull();
  });

  it("polígono degenerado (todos os pontos iguais) devolve null", () => {
    expect(extractSatinRails([[0, 0], [0, 0], [0, 0], [0, 0]])).toBeNull();
  });
});
