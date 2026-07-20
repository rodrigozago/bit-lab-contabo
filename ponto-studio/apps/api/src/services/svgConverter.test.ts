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

  it("converte elemento com svgPath em <path> com cor e ponto satin/contour", () => {
    const svg = convertProjectToSvg(makeProject([makeElement()]));
    // svgPath (10x10 page-px) reescalado pra mm via HOOP_PX_PER_MM=4 → 2.5x2.5
    expect(svg).toContain('d="M 0 0 L 2.5 0 L 2.5 2.5 L 0 2.5 Z"');
    expect(svg).toContain('fill="#ff5733"');
    expect(svg).toContain('inkstitch:fill_method="contour_fill"');
    // contour_fill não lê "angle" (confirmado: o Ink/Stitch ignora esse
    // atributo pra este fill_method) — não deve ser emitido
    expect(svg).not.toContain("inkstitch:angle");
  });

  it("tatami usa fill_method=auto_fill (não 'tatami_fill' — nome inválido, caía em fallback silencioso)", () => {
    const el = makeElement({
      stitch: { type: "tatami", density: 0.6, angle: 30 } satisfies StitchParams,
    });
    const svg = convertProjectToSvg(makeProject([el]));
    expect(svg).toContain('inkstitch:fill_method="auto_fill"');
    expect(svg).toContain('inkstitch:angle="30"');
    // densityToRange (faixa Ink/Stitch 0.25–1.0): 1.0 - 0.6 * (1.0 - 0.25) = 0.55
    expect(svg).toContain('inkstitch:row_spacing_mm="0.55"');
    // comprimento do ponto ao longo da linha é um parâmetro separado
    expect(svg).toContain('inkstitch:max_stitch_length_mm="3"');
  });

  it("satin (legado) e contour usam a MESMA faixa de row_spacing_mm do tatami e emitem max_stitch_length_mm", () => {
    // satin sempre foi mecanicamente idêntico a contour_fill — unificado
    const satin = convertProjectToSvg(makeProject([makeElement({
      stitch: { type: "satin", density: 0.6, angle: 45 } satisfies StitchParams,
    })]));
    const contour = convertProjectToSvg(makeProject([makeElement({
      stitch: { type: "contour", density: 0.6 } satisfies StitchParams,
    })]));
    // 1.0 - 0.6 * (1.0 - 0.25) = 0.55 (mesma faixa do tatami)
    expect(satin).toContain('inkstitch:row_spacing_mm="0.55"');
    expect(satin).toContain('inkstitch:max_stitch_length_mm="3"');
    expect(contour).toContain('inkstitch:fill_method="contour_fill"');
    expect(contour).toContain('inkstitch:row_spacing_mm="0.55"');
    expect(contour).toContain('inkstitch:max_stitch_length_mm="3"');
  });

  it("contour emite contour_strategy e avoid_self_crossing quando definidos", () => {
    const el = makeElement({
      stitch: { type: "contour", density: 0.5, contourStrategy: 2, avoidSelfCrossing: true } satisfies StitchParams,
    });
    const svg = convertProjectToSvg(makeProject([el]));
    expect(svg).toContain('inkstitch:contour_strategy="2"');
    expect(svg).toContain('inkstitch:avoid_self_crossing="true"');
  });

  it("meander emite fill_method/pattern/scale_percent e NÃO emite row_spacing_mm/max_stitch_length/angle-base", () => {
    const el = makeElement({
      stitch: { type: "meander", density: 0.5 } satisfies StitchParams,
    });
    const svg = convertProjectToSvg(makeProject([el]));
    expect(svg).toContain('inkstitch:fill_method="meander_fill"');
    expect(svg).toContain('inkstitch:meander_pattern="N4-21c"');
    // densityToRange (faixa 50-200%, invertida): 200 - 0.5*(200-50) = 125
    expect(svg).toContain('inkstitch:meander_scale_percent="125"');
    expect(svg).not.toContain("inkstitch:row_spacing_mm");
    expect(svg).not.toContain("inkstitch:max_stitch_length_mm");
  });

  it("circular emite fill_method/row_spacing_mm e NÃO emite max_stitch_length_mm/angle", () => {
    const el = makeElement({
      stitch: { type: "circular", density: 0.6 } satisfies StitchParams,
    });
    const svg = convertProjectToSvg(makeProject([el]));
    expect(svg).toContain('inkstitch:fill_method="circular_fill"');
    expect(svg).toContain('inkstitch:row_spacing_mm="0.55"');
    expect(svg).not.toContain("inkstitch:max_stitch_length_mm");
    expect(svg).not.toContain("inkstitch:angle");
  });

  it("running usa fill=none/stroke=cor (nunca fill=cor — vira auto_fill fantasma por baixo do stroke)", () => {
    const el = makeElement({
      color: "#123456",
      stitch: { type: "running", density: 1 } satisfies StitchParams,
    });
    const svg = convertProjectToSvg(makeProject([el]));
    expect(svg).toContain('inkstitch:stroke_method="running_stitch"');
    // faixa do running: 3.5 - 1 * (3.5 - 1.5) = 1.5
    expect(svg).toContain('inkstitch:running_stitch_length_mm="1.5"');
    expect(svg).toContain('fill="none"');
    expect(svg).toContain('stroke="#123456"');
    expect(svg).not.toContain('fill="#123456"');
    expect(svg).not.toContain("inkstitch:angle");
    expect(svg).not.toContain("inkstitch:repeats");
    expect(svg).not.toContain("inkstitch:bean_stitch_repeats");
  });

  it("running emite repeats e bean_stitch_repeats quando definidos", () => {
    const el = makeElement({
      stitch: { type: "running", density: 0.5, repeats: 3, beanStitchRepeats: 2 } satisfies StitchParams,
    });
    const svg = convertProjectToSvg(makeProject([el]));
    expect(svg).toContain('inkstitch:repeats="3"');
    expect(svg).toContain('inkstitch:bean_stitch_repeats="2"');
  });

  it("zigzag emite stroke_method/zigzag_spacing_mm/stroke-width e usa fill=none/stroke=cor", () => {
    const el = makeElement({
      color: "#654321",
      stitch: { type: "zigzag", density: 0.5, widthMm: 3 } satisfies StitchParams,
    });
    const svg = convertProjectToSvg(makeProject([el]));
    expect(svg).toContain('inkstitch:stroke_method="zigzag_stitch"');
    // faixa zigzag (0.2-0.6): 0.6 - 0.5*(0.6-0.2) = 0.4 (default do Ink/Stitch)
    expect(svg).toContain('inkstitch:zigzag_spacing_mm="0.4"');
    expect(svg).toContain('stroke-width="3"');
    expect(svg).toContain('fill="none"');
    expect(svg).toContain('stroke="#654321"');
    expect(svg).not.toContain("inkstitch:stroke_pull_compensation_mm");
  });

  it("zigzag emite stroke_pull_compensation_mm e repeats quando definidos", () => {
    const el = makeElement({
      stitch: { type: "zigzag", density: 0.5, widthMm: 3, pullCompensationMm: 0.2, repeats: 2 } satisfies StitchParams,
    });
    const svg = convertProjectToSvg(makeProject([el]));
    expect(svg).toContain('inkstitch:stroke_pull_compensation_mm="0.2"');
    expect(svg).toContain('inkstitch:repeats="2"');
  });

  it("ripple emite stroke_method/running_stitch_length_mm e usa fill=none/stroke=cor", () => {
    const el = makeElement({
      color: "#00aaff",
      stitch: { type: "ripple", density: 1 } satisfies StitchParams,
    });
    const svg = convertProjectToSvg(makeProject([el]));
    expect(svg).toContain('inkstitch:stroke_method="ripple_stitch"');
    expect(svg).toContain('inkstitch:running_stitch_length_mm="1.5"');
    expect(svg).toContain('fill="none"');
    expect(svg).toContain('stroke="#00aaff"');
    expect(svg).not.toContain("inkstitch:line_count");
    expect(svg).not.toContain("inkstitch:join_style");
  });

  it("ripple emite line_count/join_style/repeats/bean_stitch_repeats quando definidos", () => {
    const el = makeElement({
      stitch: {
        type: "ripple", density: 0.5, lineCount: 15, joinStyle: 1, repeats: 2, beanStitchRepeats: 1,
      } satisfies StitchParams,
    });
    const svg = convertProjectToSvg(makeProject([el]));
    expect(svg).toContain('inkstitch:line_count="15"');
    expect(svg).toContain('inkstitch:join_style="1"');
    expect(svg).toContain('inkstitch:repeats="2"');
    expect(svg).toContain('inkstitch:bean_stitch_repeats="1"');
  });

  it("underlay sempre emite fill_underlay explícito (default do Ink/Stitch é true)", () => {
    // Sem emitir "false" explicitamente quando o usuário desliga, o
    // Ink/Stitch aplicaria underlay do mesmo jeito (default true) — o
    // toggle da UI viraria um no-op silencioso.
    const off = makeElement({
      stitch: { type: "tatami", density: 0.6, angle: 45, underlay: false } satisfies StitchParams,
    });
    const on = makeElement({
      stitch: { type: "tatami", density: 0.6, angle: 45, underlay: true } satisfies StitchParams,
    });
    expect(convertProjectToSvg(makeProject([off]))).toContain('inkstitch:fill_underlay="false"');
    expect(convertProjectToSvg(makeProject([on]))).toContain('inkstitch:fill_underlay="true"');
  });

  it("rotação vira coordenadas ROTACIONADAS no próprio \"d\" (não atributo custom, que o Ink/Stitch ignora)", () => {
    // quadrado 2.5x2.5mm em (0,0), centro (1.25,1.25), rotacionado 90° —
    // vira o mesmo quadrado com os vértices deslocados (matemática conferida
    // em svgTransform.test.ts::rotatePathData)
    const el = makeElement({ rotation: Math.PI / 2 });
    const svg = convertProjectToSvg(makeProject([el]));
    expect(svg).toContain('d="M 2.5 0 L 2.5 2.5 L 0 2.5 L 0 0 Z"');
    expect(svg).not.toContain("transform=");
    expect(svg).not.toContain("ponto:rotation");
  });

  it("rotação também é aplicada nos paths extraídos do svgContent", () => {
    const el = makeElement({
      rotation: Math.PI / 4,
      svgContent: `<svg viewBox="0 0 10 10"><path d="M 1 1 Z" fill="#aabbcc"/></svg>`,
    });
    const svg = convertProjectToSvg(makeProject([el]));
    // ponto (0.25,0.25) [pós contain-fit] rotacionado 45° em torno de (1.25,1.25)
    expect(svg).toContain('d="M 1.25 -0.164 Z"');
    expect(svg).not.toContain("transform=");
  });

  it("sem rotação, o \"d\" não é alterado pela rotação", () => {
    const svg = convertProjectToSvg(makeProject([makeElement()]));
    expect(svg).toContain('d="M 0 0 L 2.5 0 L 2.5 2.5 L 0 2.5 Z"');
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
