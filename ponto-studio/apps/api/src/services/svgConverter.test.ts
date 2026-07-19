import { describe, it, expect } from "vitest";
import type { EmbroideryProject, EmbroideryElement, StitchParams } from "@ponto-studio/shared";
import { convertProjectToSvg } from "./svgConverter.js";

// svgPath está em page-px do tldraw (ver rectToSvgPath/HOOP_PX_PER_MM); um
// retângulo 10x10 vira 2.5x2.5mm no canvas — usado como bbox do elemento
// pra contain-fit do svgContent (extractAndAnnotatePaths) ou reescalado
// direto (elementToSvgPath, fallback sem svgContent).
function makeElement(overrides: Partial<EmbroideryElement> = {}): EmbroideryElement {
  return {
    id: "el-1",
    svgPath: "M 0 0 L 10 0 L 10 10 L 0 10 Z",
    color: "#ff5733",
    stitch: { type: "satin", density: 0.6, angle: 45 },
    ...overrides,
  };
}

function makeProject(elements: EmbroideryElement[], name = "Meu Bordado"): EmbroideryProject {
  return {
    id: "proj-1",
    name,
    canvas: { widthMm: 100, heightMm: 80 },
    elements,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("convertProjectToSvg", () => {
  it("gera SVG com dimensões e viewBox do canvas", () => {
    const svg = convertProjectToSvg(makeProject([]));
    expect(svg).toContain('width="100mm"');
    expect(svg).toContain('height="80mm"');
    expect(svg).toContain('viewBox="0 0 100 80"');
    expect(svg).toContain('xmlns:inkstitch="http://inkstitch.org/namespace"');
  });

  it("escapa caracteres XML no nome do projeto", () => {
    const svg = convertProjectToSvg(makeProject([], `Bordado <"especial"> & Cia`));
    expect(svg).toContain("<title>Bordado &lt;&quot;especial&quot;&gt; &amp; Cia</title>");
  });

  it("converte elemento com svgPath em <path> com cor e ponto satin", () => {
    const svg = convertProjectToSvg(makeProject([makeElement()]));
    // svgPath (10x10 page-px) reescalado pra mm via HOOP_PX_PER_MM=4 → 2.5x2.5
    expect(svg).toContain('d="M 0 0 L 2.5 0 L 2.5 2.5 L 0 2.5 Z"');
    expect(svg).toContain('fill="#ff5733"');
    expect(svg).toContain('inkstitch:angle="45"');
    expect(svg).toContain('inkstitch:fill_method="contour_fill"');
  });

  it("gera atributos tatami com line_distance derivado da densidade + max_stitch_length", () => {
    const el = makeElement({
      stitch: { type: "tatami", density: 0.6, angle: 30 } satisfies StitchParams,
    });
    const svg = convertProjectToSvg(makeProject([el]));
    expect(svg).toContain('inkstitch:fill_method="tatami_fill"');
    // densityToMm (faixa Ink/Stitch 0.25–1.0): 1.0 - 0.6 * (1.0 - 0.25) = 0.55
    expect(svg).toContain('inkstitch:line_distance="0.55mm"');
    // comprimento do ponto ao longo da linha é um parâmetro separado
    expect(svg).toContain('inkstitch:max_stitch_length="3mm"');
  });

  it("satin usa a faixa de zigzag spacing (0.2–0.8mm)", () => {
    const el = makeElement({
      stitch: { type: "satin", density: 0.6, angle: 45 } satisfies StitchParams,
    });
    const svg = convertProjectToSvg(makeProject([el]));
    // 0.8 - 0.6 * (0.8 - 0.2) = 0.44
    expect(svg).toContain('inkstitch:line_distance="0.44mm"');
  });

  it("gera atributos de running stitch", () => {
    const el = makeElement({
      stitch: { type: "running", density: 1, angle: 0 } satisfies StitchParams,
    });
    const svg = convertProjectToSvg(makeProject([el]));
    expect(svg).toContain('inkstitch:stroke_method="running_stitch"');
    // faixa do running: 3.5 - 1 * (3.5 - 1.5) = 1.5
    expect(svg).toContain('inkstitch:running_stitch_length="1.5mm"');
  });

  it("rotação vira ponto:rotation* POR PATH (não transform, que o worker ignora)", () => {
    // elemento de 2.5×2.5mm em (0,0) rotacionado 90° → centro (1.25, 1.25)
    const el = makeElement({ rotation: Math.PI / 2 });
    const svg = convertProjectToSvg(makeProject([el]));
    expect(svg).toContain('ponto:rotation="90"');
    expect(svg).toContain('ponto:rotation_cx="1.25"');
    expect(svg).toContain('ponto:rotation_cy="1.25"');
    expect(svg).toContain('xmlns:ponto="https://ponto.studio/ns"');
    expect(svg).not.toContain("transform=");
  });

  it("rotação também é emitida nos paths extraídos do svgContent", () => {
    const el = makeElement({
      rotation: Math.PI / 4,
      svgContent: `<svg viewBox="0 0 10 10"><path d="M 1 1 Z" fill="#aabbcc"/></svg>`,
    });
    const svg = convertProjectToSvg(makeProject([el]));
    expect(svg).toContain('ponto:rotation="45"');
    expect(svg).not.toContain("transform=");
  });

  it("sem rotação, nenhum atributo ponto:rotation é emitido", () => {
    const svg = convertProjectToSvg(makeProject([makeElement()]));
    expect(svg).not.toContain("ponto:rotation");
  });

  it("usa a cor do elemento (el.color) em todos os paths, mesmo os com fill próprio", () => {
    // Regressão: antes, um path com fill próprio (ex.: cor detectada na
    // análise da imagem) IGNORAVA a cor escolhida no painel de propriedades —
    // mudar "Cor do fio" não tinha efeito nenhum no SVG exportado/preview.
    const el = makeElement({
      color: "#00ff00",
      svgContent: `<svg viewBox="0 0 10 10">
        <path d="M 1 1 Z" fill="#aabbcc" inkstitch:fill_method="antigo"/>
        <path d="M 2 2 Z"/>
      </svg>`,
    });
    const svg = convertProjectToSvg(makeProject([el]));
    // os dois paths (com e sem fill próprio) usam a cor do elemento
    expect(svg).not.toContain('fill="#aabbcc"');
    const fillCount = (svg.match(/fill="#00ff00"/g) ?? []).length;
    expect(fillCount).toBe(2);
    expect(svg).not.toContain('inkstitch:fill_method="antigo"');
    // agrupado pelo id do elemento
    expect(svg).toContain('<g id="el-1">');
  });

  it("não duplica o atributo stroke quando o path original já tem stroke=\"none\"", () => {
    const el = makeElement({
      color: "#aabbcc",
      svgContent: `<svg viewBox="0 0 10 10"><path d="M 1 1 Z" fill="#aabbcc" stroke="none"/></svg>`,
    });
    const svg = convertProjectToSvg(makeProject([el]));
    const pathLine = svg.split("\n").find((l) => l.includes('fill="#aabbcc"'))!;
    const strokeCount = (pathLine.match(/stroke=/g) ?? []).length;
    expect(strokeCount).toBe(1);
  });

  it("normaliza paths self-closing com atributos em várias linhas", () => {
    const el = makeElement({
      color: "#E64980",
      svgContent: `<svg viewBox="0 0 100 100">\n  <path\r\n     d="M 10,10 H 50 V 50 H 10 Z"\r\n     fill="#E64980"\r\n     inkstitch:angle="30" />\n</svg>`,
    });
    const svg = convertProjectToSvg(makeProject([el]));
    const pathLine = svg.split("\n").find((l) => l.includes('fill="#E64980"'));
    expect(pathLine).toBeDefined();
    // não pode sobrar "/" solto no meio dos atributos nem quebras de linha
    expect(pathLine!).not.toMatch(/\/\s+fill=/);
    expect(pathLine!).toContain('fill="#E64980"');
  });

  it("reescala o d do path da IA do viewBox de origem para o bbox do elemento no canvas (mm)", () => {
    // svgPath default (10x10 page-px) → bbox do elemento 2.5x2.5mm em (0,0);
    // viewBox 100x100 → contain-fit escala 0.025 dentro desse bbox (não mais
    // do canvas inteiro — é o que faz redimensionar a camada no editor
    // realmente mudar o tamanho do bordado exportado)
    const el = makeElement({
      svgContent: `<svg viewBox="0 0 100 100"><path d="M 10,10 H 50 V 50 H 10 Z" fill="#E64980"/></svg>`,
    });
    const svg = convertProjectToSvg(makeProject([el]));
    expect(svg).toContain('d="M 0.25 0.25 H 1.25 V 1.25 H 0.25 Z"');
  });

  it("regressão: id=\"...\" antes de d=\"...\" não deve corromper a extração do path (colisão 'id=' contém 'd=')", () => {
    // Formato real retornado pela IA: id vem antes de d no path.
    const el = makeElement({
      svgContent: `<svg viewBox="0 0 200 200"><path id="heart_fill" fill="#ed1c24" stroke="none" inkstitch:fill_method="tatami" d="M100 170 L 50 50 Z"/></svg>`,
    });
    const svg = convertProjectToSvg(makeProject([el], "Meu Bordado"));
    // "id" deve ser preservado intacto e o "d" real (não "heart_fill") deve
    // conter os pontos do path reescalados — (?<![a-zA-Z]) evita o falso
    // positivo de "d=" casar dentro de "id=" na própria asserção também
    expect(svg).toContain('id="heart_fill"');
    expect(svg).not.toMatch(/(?<![a-zA-Z])d="heart_fill"/);
    expect(svg).toMatch(/(?<![a-zA-Z])d="M [\d.]+ [\d.]+ L [\d.]+ [\d.]+ Z"/);
  });

  it("regressão: viewBox 200x200 da IA em canvas 100x100mm não deve extrapolar o bastidor", () => {
    // Bug real observado: SVG da IA com viewBox 0 0 200 200 exportado sem reescala
    // gerava um DST de ~176x168mm num bastidor de 100x100mm.
    // svgPath cobrindo o bastidor inteiro (100mm × HOOP_PX_PER_MM=4 = 400px) —
    // é o que uma importação nova gera de fato (contain-fit no bastidor).
    const el = makeElement({
      svgPath: "M 0 0 L 400 0 L 400 400 L 0 400 Z",
      svgContent: `<svg viewBox="0 0 200 200"><path d="M100 170 C91 160 72 143 58 124 C43 104 34 84 37 68 C40 50 55 37 75 36 C90 35 99 45 100 61 C101 45 110 35 126 36 C147 38 161 51 163 68 C166 85 158 106 142 126 C128 145 109 160 100 170 z" fill="#ed1c24"/></svg>`,
    });
    const project: EmbroideryProject = {
      id: "proj-heart", name: "Coração", canvas: { widthMm: 100, heightMm: 100 },
      elements: [el], createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
    };
    const svg = convertProjectToSvg(project);
    // \s antes de d= evita casar com o "d" de dentro de id="el-1"
    const dMatch = /\sd="([^"]+)"/.exec(svg)!;
    const coords = (dMatch[1]!.match(/-?\d+\.?\d*/g) ?? []).map(Number);
    const xs = coords.filter((_, i) => i % 2 === 0);
    const ys = coords.filter((_, i) => i % 2 === 1);
    expect(Math.max(...xs)).toBeLessThanOrEqual(100);
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...ys)).toBeLessThanOrEqual(100);
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(0);
  });

  it("usa svgPath como fallback quando svgContent não tem paths", () => {
    const el = makeElement({ svgContent: "<svg><rect width='5' height='5'/></svg>" });
    const svg = convertProjectToSvg(makeProject([el]));
    // fallback também reescala page-px → mm (mesma conversão de elementToSvgPath)
    expect(svg).toContain('d="M 0 0 L 2.5 0 L 2.5 2.5 L 0 2.5 Z"');
  });
});
