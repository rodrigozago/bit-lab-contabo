import { describe, it, expect } from "vitest";
import {
  vectorPathVerticesToSvgPath,
  svgPathToVectorPathVertices,
  vectorPathVerticesToPolyline,
  scaleVectorPathVertices,
  vectorPathShapeToSvgPath,
} from "./vectorPath.ts";
import type { VectorPathVertex } from "../shapes/VectorPathShape.ts";

describe("vectorPathVerticesToSvgPath", () => {
  it("só retas (sem handles) vira M/L/Z", () => {
    const vertices: VectorPathVertex[] = [
      { id: "a", x: 0, y: 0 },
      { id: "b", x: 10, y: 0 },
      { id: "c", x: 10, y: 10 },
    ];
    expect(vectorPathVerticesToSvgPath(vertices, true)).toBe(
      "M 0 0 L 10 0 L 10 10 L 0 0 Z"
    );
  });

  it("aberto não emite Z nem segmento de fechamento", () => {
    const vertices: VectorPathVertex[] = [
      { id: "a", x: 0, y: 0 },
      { id: "b", x: 10, y: 0 },
    ];
    expect(vectorPathVerticesToSvgPath(vertices, false)).toBe("M 0 0 L 10 0");
  });

  it("vértice com cpOut vira curva (C), espelhando o lado sem handle na própria âncora de destino", () => {
    const vertices: VectorPathVertex[] = [
      { id: "a", x: 0, y: 0, cpOut: { x: 5, y: 5 } },
      { id: "b", x: 10, y: 0 },
    ];
    // c1 = a + cpOut = (5,5); c2 = b (sem cpIn, zero offset) = (10,0)
    expect(vectorPathVerticesToSvgPath(vertices, false)).toBe("M 0 0 C 5 5 10 0 10 0");
  });

  it("vértice com cpIn (destino) também vira curva", () => {
    const vertices: VectorPathVertex[] = [
      { id: "a", x: 0, y: 0 },
      { id: "b", x: 10, y: 0, cpIn: { x: -5, y: 5 } },
    ];
    // c1 = a (sem cpOut) = (0,0); c2 = b + cpIn = (5,5)
    expect(vectorPathVerticesToSvgPath(vertices, false)).toBe("M 0 0 C 0 0 5 5 10 0");
  });

  it("fechado com curva emite o segmento de fechamento explícito antes do Z", () => {
    const vertices: VectorPathVertex[] = [
      { id: "a", x: 0, y: 0 },
      { id: "b", x: 10, y: 0 },
      { id: "c", x: 10, y: 10, cpOut: { x: 0, y: 5 } },
    ];
    const d = vectorPathVerticesToSvgPath(vertices, true);
    expect(d).toContain("C 10 15 0 0 0 0"); // fechamento: c de (10,10)->(0,0)
    expect(d.endsWith("Z")).toBe(true);
  });
});

describe("svgPathToVectorPathVertices", () => {
  it("round-trip com só retas, aberto", () => {
    const original: VectorPathVertex[] = [
      { id: "a", x: 0, y: 0 },
      { id: "b", x: 10, y: 0 },
      { id: "c", x: 10, y: 10 },
    ];
    const d = vectorPathVerticesToSvgPath(original, false);
    const parsed = svgPathToVectorPathVertices(d);
    expect(parsed).not.toBeNull();
    expect(parsed!.isClosed).toBe(false);
    expect(parsed!.vertices.map((v) => ({ x: v.x, y: v.y }))).toEqual([
      { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 },
    ]);
  });

  it("round-trip com curvas mistas (reta + curva), fechado", () => {
    const original: VectorPathVertex[] = [
      { id: "a", x: 0, y: 0, cpOut: { x: 3, y: 3 } },
      { id: "b", x: 20, y: 0 },
      { id: "c", x: 20, y: 20, cpIn: { x: 0, y: -4 } },
    ];
    const d = vectorPathVerticesToSvgPath(original, true);
    const parsed = svgPathToVectorPathVertices(d);
    expect(parsed).not.toBeNull();
    expect(parsed!.isClosed).toBe(true);
    expect(parsed!.vertices).toHaveLength(3);
    expect(parsed!.vertices[0]).toMatchObject({ x: 0, y: 0, cpOut: { x: 3, y: 3 } });
    expect(parsed!.vertices[0]!.cpIn).toBeUndefined();
    expect(parsed!.vertices[1]).toMatchObject({ x: 20, y: 0 });
    expect(parsed!.vertices[2]).toMatchObject({ x: 20, y: 20, cpIn: { x: 0, y: -4 } });
  });

  it("vértice assimétrico — só cpIn ou só cpOut sobrevive ao round-trip sem inventar o outro lado", () => {
    const original: VectorPathVertex[] = [
      { id: "a", x: 0, y: 0, cpOut: { x: 4, y: 0 } },
      { id: "b", x: 10, y: 0, cpIn: { x: -2, y: 3 } },
      { id: "c", x: 5, y: 10 },
    ];
    const d = vectorPathVerticesToSvgPath(original, false);
    const parsed = svgPathToVectorPathVertices(d)!;
    expect(parsed.vertices[0]!.cpIn).toBeUndefined();
    expect(parsed.vertices[0]!.cpOut).toEqual({ x: 4, y: 0 });
    expect(parsed.vertices[1]!.cpOut).toBeUndefined();
    expect(parsed.vertices[1]!.cpIn).toEqual({ x: -2, y: 3 });
  });

  it("null pra d ausente, sem M inicial, com menos de 2 pontos, ou comando fora do alfabeto (ex.: arco)", () => {
    expect(svgPathToVectorPathVertices(undefined)).toBeNull();
    expect(svgPathToVectorPathVertices("L 10 10")).toBeNull();
    expect(svgPathToVectorPathVertices("M 0 0")).toBeNull();
    expect(svgPathToVectorPathVertices("M 0 0 A 5 5 0 0 1 10 10")).toBeNull();
  });
});

describe("vectorPathVerticesToPolyline", () => {
  it("segmento reto vira só os 2 pontos, sem amostragem extra", () => {
    const vertices: VectorPathVertex[] = [{ id: "a", x: 0, y: 0 }, { id: "b", x: 10, y: 0 }];
    expect(vectorPathVerticesToPolyline(vertices, false)).toEqual([{ x: 0, y: 0 }, { x: 10, y: 0 }]);
  });

  it("segmento com curva amostra pontos intermediários (mais que só as 2 pontas)", () => {
    const vertices: VectorPathVertex[] = [
      { id: "a", x: 0, y: 0, cpOut: { x: 0, y: 20 } },
      { id: "b", x: 20, y: 0, cpIn: { x: 0, y: 20 } },
    ];
    const points = vectorPathVerticesToPolyline(vertices, false);
    expect(points.length).toBeGreaterThan(2);
    // a curva "estufa" pra baixo (y positivo) no meio — não é uma reta
    const mid = points[Math.floor(points.length / 2)]!;
    expect(mid.y).toBeGreaterThan(1);
  });
});

describe("scaleVectorPathVertices", () => {
  it("escala âncora e translada pro destino; handles só escalam (nunca transladam)", () => {
    const vertices: VectorPathVertex[] = [
      { id: "a", x: 10, y: 10, cpOut: { x: 4, y: 0 } },
    ];
    const scaled = scaleVectorPathVertices(vertices, 2, 100, 50);
    expect(scaled[0]).toEqual({ id: "a", x: 120, y: 70, cpOut: { x: 8, y: 0 } });
  });
});

describe("vectorPathShapeToSvgPath", () => {
  it("centraliza o path no ponto pedido, preservando a curvatura", () => {
    const shape = {
      x: 0, y: 0,
      props: {
        vertices: [
          { id: "a", x: 0, y: 0 },
          { id: "b", x: 20, y: 0 },
          { id: "c", x: 10, y: 20 },
        ] as VectorPathVertex[],
        isClosed: true,
      },
    };
    const d = vectorPathShapeToSvgPath(shape, { x: 100, y: 100 });
    expect(d).not.toBeNull();
    const parsed = svgPathToVectorPathVertices(d!)!;
    // bbox original: x:0..20 (centro 10), y:0..20 (centro 10) -> desloca (+90,+90)
    expect(parsed.vertices[0]).toMatchObject({ x: 90, y: 90 });
  });

  it("null com menos de 2 vértices", () => {
    const shape = { x: 0, y: 0, props: { vertices: [{ id: "a", x: 0, y: 0 }] as VectorPathVertex[], isClosed: false } };
    expect(vectorPathShapeToSvgPath(shape, { x: 0, y: 0 })).toBeNull();
  });
});
