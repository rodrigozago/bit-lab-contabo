import { describe, it, expect } from "vitest";
import type { EmbroideryElement } from "@ponto-studio/shared";
import { splitSvgByColor, splitSvgIntoRegions, normalizeColor, recolorSvg, composeThumbnail, normalizeSvgToFillContainer } from "./svgLayers.ts";

function makeElement(overrides: Partial<EmbroideryElement> = {}): EmbroideryElement {
  return {
    id: "el-1",
    svgPath: "M 0 0 Z",
    color: "#ff0000",
    stitch: { type: "satin", density: 0.6, angle: 45 },
    ...overrides,
  };
}

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

describe("splitSvgIntoRegions", () => {
  it("divide uma camada (g fill com N paths) em N SVGs de 1 path cada, mesmo viewBox", () => {
    const svg = `<svg ${NS} viewBox="0 0 100 100">
  <g fill="#ff0000">
    <path d="M0 0h10v10H0Z"/>
    <path d="M50 50h10v10H50Z"/>
    <path d="M80 0h10v10H80Z"/>
  </g>
</svg>`;
    const regions = splitSvgIntoRegions(svg);
    expect(regions).toHaveLength(3);
    for (const region of regions) {
      expect((region.match(/<path/g) ?? []).length).toBe(1);
      expect(region).toContain('viewBox="0 0 100 100"');
      // fill herdado do <g> vira fill explícito na região
      expect(region).toContain('fill="#ff0000"');
    }
    // as coordenadas absolutas de cada região são preservadas
    expect(regions[1]).toContain("M50 50");
  });

  it("com 1 path só (nada a separar) devolve o SVG original intacto", () => {
    const svg = `<svg ${NS} viewBox="0 0 10 10"><g fill="#123456"><path d="M0 0Z"/></g></svg>`;
    expect(splitSvgIntoRegions(svg)).toEqual([svg]);
  });

  it("conteúdo que não é SVG devolve o original intacto", () => {
    expect(splitSvgIntoRegions("<div>oi</div>")).toEqual(["<div>oi</div>"]);
  });

  it("path com fill próprio (formato da IA, sem g) preserva a cor do path", () => {
    const svg = `<svg ${NS} viewBox="0 0 20 20">
      <path d="M0 0h5v5H0Z" fill="#aa0000"/>
      <path d="M10 10h5v5H10Z" fill="#aa0000"/>
    </svg>`;
    const regions = splitSvgIntoRegions(svg);
    expect(regions).toHaveLength(2);
    expect(regions[0]).toContain('fill="#aa0000"');
  });
});

describe("recolorSvg", () => {
  it("troca o fill de todos os paths pela cor nova", () => {
    const svg = `<svg ${NS} viewBox="0 0 10 10">
      <path d="M0 0h1v1H0Z" fill="#ff0000"/>
      <path d="M2 2h1v1H2Z" fill="#ff0000"/>
    </svg>`;
    const result = recolorSvg(svg, "#00ff00");
    expect(result).not.toContain('fill="#ff0000"');
    expect((result.match(/fill="#00ff00"/g) ?? []).length).toBe(2);
  });

  it("troca o fill herdado do <g> pai também", () => {
    const svg = `<svg ${NS} viewBox="0 0 10 10"><g fill="#123456"><path d="M0 0Z"/></g></svg>`;
    const result = recolorSvg(svg, "#abcdef");
    expect(result).toContain('fill="#abcdef"');
    expect(result).not.toContain('fill="#123456"');
  });

  it("preserva o viewBox e a estrutura do documento", () => {
    const svg = `<svg ${NS} viewBox="0 0 50 40"><path d="M0 0Z" fill="#000"/></svg>`;
    const result = recolorSvg(svg, "#7c5cbf");
    expect(result).toContain('viewBox="0 0 50 40"');
  });

  it("retorna o svg original se não conseguir parsear como SVG", () => {
    const notSvg = "<div>oi</div>";
    expect(recolorSvg(notSvg, "#fff")).toBe(notSvg);
  });
});

describe("composeThumbnail", () => {
  it("retorna null quando nenhum elemento tem svgContent", () => {
    const elements = [makeElement({ svgContent: undefined })];
    expect(composeThumbnail(elements)).toBeNull();
  });

  it("empilha os paths de todos os elementos recoloridos pela cor atual", () => {
    const elements = [
      makeElement({
        id: "el-1",
        color: "#00ff00",
        svgContent: `<svg ${NS} viewBox="0 0 100 100"><path d="M0 0h5v5H0Z" fill="#ff0000"/></svg>`,
      }),
      makeElement({
        id: "el-2",
        color: "#0000ff",
        svgContent: `<svg ${NS} viewBox="0 0 100 100"><path d="M10 10h5v5H10Z" fill="#ff0000"/></svg>`,
      }),
    ];
    const result = composeThumbnail(elements);
    expect(result).not.toBeNull();
    // viewBox é recalculado a partir do bbox real dos paths (0,0)-(15,15) com
    // 5% de padding — não o viewBox original do SVG (que pode não bater com
    // as coordenadas reais dos paths, causa da miniatura mal posicionada)
    expect(result).toContain('viewBox="-0.5 -0.5 11 11"');
    expect((result!.match(/<path/g) ?? []).length).toBe(2);
    expect(result).toContain('fill="#00ff00"');
    expect(result).toContain('fill="#0000ff"');
    expect(result).not.toContain('fill="#ff0000"');
  });

  it("ajusta o viewBox ao bounding box real dos paths, não ao viewBox original do SVG", () => {
    const elements = [
      makeElement({
        id: "el-1",
        svgContent: `<svg ${NS} viewBox="0 0 40 40"><path d="M5 5 L15 5 L15 15 L5 15 Z" fill="#000"/></svg>`,
      }),
    ];
    const result = composeThumbnail(elements);
    // bbox do path é (5,5)-(15,15); o viewBox original "0 0 40 40" seria
    // enganoso (o path não ocupa a imagem inteira) — por isso reescalamos
    expect(result).not.toContain('viewBox="0 0 40 40"');
    expect(result).toContain('viewBox="4.5 4.5 11 11"');
  });

  it("ignora elementos sem svgContent mas usa os que têm", () => {
    const elements = [
      makeElement({ id: "el-1", svgContent: undefined }),
      makeElement({ id: "el-2", svgContent: `<svg ${NS} viewBox="0 0 10 10"><path d="M0 0Z" fill="#000"/></svg>` }),
    ];
    const result = composeThumbnail(elements);
    expect(result).not.toBeNull();
    expect((result!.match(/<path/g) ?? []).length).toBe(1);
  });
});

describe("normalizeSvgToFillContainer", () => {
  it("substitui width/height em px por 100% preservando o viewBox", () => {
    const svg = `<svg ${NS} width="800" height="600" viewBox="0 0 800 600"><rect width="10" height="10"/></svg>`;
    const result = normalizeSvgToFillContainer(svg);
    expect(result).toContain('width="100%"');
    expect(result).toContain('height="100%"');
    expect(result).toContain('viewBox="0 0 800 600"');
  });

  it("gera viewBox a partir de width/height quando o SVG não tem um", () => {
    const svg = `<svg ${NS} width="800" height="600"><rect width="10" height="10"/></svg>`;
    const result = normalizeSvgToFillContainer(svg);
    expect(result).toContain('viewBox="0 0 800 600"');
    expect(result).toContain('width="100%"');
  });

  it("preserva o conteúdo interno do SVG", () => {
    const svg = `<svg ${NS} width="100" height="100"><path d="M0 0Z" fill="#ff0000"/></svg>`;
    const result = normalizeSvgToFillContainer(svg);
    expect(result).toContain('fill="#ff0000"');
  });
});
