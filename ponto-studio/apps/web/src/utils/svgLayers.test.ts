import { describe, it, expect } from "vitest";
import { splitSvgByColor, normalizeColor } from "./svgLayers.ts";

const NS = 'xmlns="http://www.w3.org/2000/svg"';

describe("normalizeColor", () => {
  it("normaliza hex curto e maiúsculo para #rrggbb minúsculo", () => {
    expect(normalizeColor("#F00")).toBe("#ff0000");
    expect(normalizeColor("#AABBCC")).toBe("#aabbcc");
  });

  it("converte rgb() para hex", () => {
    expect(normalizeColor("rgb(255, 0, 128)")).toBe("#ff0080");
  });

  it("usa preto como default para vazio/none", () => {
    expect(normalizeColor(undefined)).toBe("#000000");
    expect(normalizeColor("none")).toBe("#000000");
  });
});

describe("splitSvgByColor", () => {
  it("separa paths soltos por cor (formato da IA)", () => {
    const svg = `<svg ${NS} viewBox="0 0 100 100">
      <path d="M0 0h10v10H0Z" fill="#ff0000"/>
      <path d="M20 20h10v10H20Z" fill="#00ff00"/>
      <path d="M40 40h10v10H40Z" fill="#FF0000"/>
    </svg>`;

    const layers = splitSvgByColor(svg);
    expect(layers).toHaveLength(2);

    const red = layers.find((l) => l.color === "#ff0000")!;
    // as duas regiões vermelhas (desconectadas) ficam na MESMA camada
    expect((red.svgContent.match(/<path/g) ?? []).length).toBe(2);
  });

  it("agrupa paths que herdam fill do <g> pai (formato do worker)", () => {
    const svg = `<svg ${NS} viewBox="0 0 50 50">
      <g fill="#123456"><path d="M0 0h5v5H0Z"/><path d="M10 10h5v5H10Z"/></g>
      <g fill="#abcdef"><path d="M20 20h5v5H20Z"/></g>
    </svg>`;

    const layers = splitSvgByColor(svg);
    expect(layers).toHaveLength(2);
    expect(layers.map((l) => l.color).sort()).toEqual(["#123456", "#abcdef"]);
  });

  it("preserva o viewBox do documento em cada camada", () => {
    const svg = `<svg ${NS} viewBox="0 0 200 150"><path d="M0 0Z" fill="#000"/></svg>`;
    const layers = splitSvgByColor(svg);
    expect(layers[0].svgContent).toContain('viewBox="0 0 200 150"');
  });

  it("path sem fill nenhum cai na cor default", () => {
    const svg = `<svg ${NS} viewBox="0 0 10 10"><path d="M0 0Z"/></svg>`;
    const layers = splitSvgByColor(svg);
    expect(layers).toHaveLength(1);
    expect(layers[0].color).toBe("#000000");
  });

  it("retorna vazio para conteúdo que não é SVG", () => {
    expect(splitSvgByColor("<div>oi</div>")).toEqual([]);
  });
});
