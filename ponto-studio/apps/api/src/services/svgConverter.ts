import { HOOP_PX_PER_MM, type EmbroideryProject, type EmbroideryElement, type CanvasSize, type StitchType } from "@ponto-studio/shared";
import { parseViewBoxDimensions, computeContainTransform, scalePathData, type Dimensions } from "./svgTransform.js";

/**
 * Converte um EmbroideryProject em SVG compatível com pyembroidery/Ink/Stitch.
 *
 * Cada EmbroideryElement pode ter:
 *   - svgContent: SVG completo gerado pela IA → extrai os <path> de dentro
 *   - svgPath: atributo "d" de um path simples (shapes do tldraw)
 */
export function convertProjectToSvg(project: EmbroideryProject): string {
  const { canvas, elements, name } = project;

  const elementsSvg = elements.map((el) => elementToSvgGroup(el, canvas)).join("\n  ");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg
  xmlns="http://www.w3.org/2000/svg"
  xmlns:inkstitch="http://inkstitch.org/namespace"
  xmlns:ponto="https://ponto.studio/ns"
  width="${canvas.widthMm}mm"
  height="${canvas.heightMm}mm"
  viewBox="0 0 ${canvas.widthMm} ${canvas.heightMm}"
>
  <title>${escapeXml(name)}</title>
  ${elementsSvg}
</svg>`;
}

function elementToSvgGroup(el: EmbroideryElement, canvas: CanvasSize): string {
  // Se tem SVG completo da IA, extrai os paths de dentro e reaplica atributos inkstitch
  if (el.svgContent && el.svgContent.trim().startsWith("<")) {
    return extractAndAnnotatePaths(el, canvas);
  }
  // Caso simples: svgPath é o atributo "d"
  return elementToSvgPath(el);
}

/**
 * Extrai todos os <path> do SVG gerado pela IA, preserva suas cores originais
 * e sobrescreve/adiciona os atributos inkstitch com as configurações do elemento.
 *
 * As coordenadas de "d" são reescaladas do viewBox do SVG da IA para o canvas
 * do projeto (em mm) — necessário porque o worker de bordado lê os números
 * crus de "d" como milímetros e ignora viewBox/transform de contêiner.
 */
interface PathPart {
  /** atributos originais sem fill/stroke/d/inkstitch (para não duplicar) */
  cleanAttrs: string;
  /** atributo "d" cru */
  d: string;
}

/**
 * Extrai os <path> de um SVG, separando attrs limpos e d. Reusado por export
 * e preview. O `fill` NÃO vem daqui — é sempre `el.color` (a cor do fio que o
 * usuário escolhe no painel de propriedades), nunca a cor original detectada
 * na análise da imagem. Antes disso, `el.color` só valia como fallback quando
 * o path não tinha `fill` próprio — como o pipeline local sempre grava um
 * `fill` explícito em cada path, mudar a cor no painel não tinha efeito
 * nenhum no SVG final (preview/export). Ver `elementToSvgGroup`/callers.
 */
function extractPathParts(svg: string): PathPart[] {
  const pathRegex = /<path([^>]*)\/?>/gi;
  const parts: PathPart[] = [];
  let match: RegExpExecArray | null;

  while ((match = pathRegex.exec(svg)) !== null) {
    // normaliza espaços/quebras de linha e remove a barra do self-closing
    const attrs = (match[1] ?? "").replace(/\s+/g, " ").replace(/\/\s*$/, "");
    // (?<![a-zA-Z]) evita casar o "d=" de dentro de id="..." (a IA gera id antes de d)
    const dMatch = /(?<![a-zA-Z])d=["']([^"']+)["']/i.exec(attrs);

    const cleanAttrs = attrs
      .replace(/inkstitch:[a-z_]+=["'][^"']*["']/gi, "")
      .replace(/fill=["'][^"']*["']/gi, "")
      .replace(/stroke=["'][^"']*["']/gi, "")
      .replace(/(?<![a-zA-Z])d=["'][^"']*["']/gi, "")
      .replace(/\s+/g, " ")
      .trim();

    parts.push({ cleanAttrs, d: dMatch?.[1] ?? "" });
  }

  return parts;
}

/**
 * Bounding box do elemento DENTRO DO CANVAS, em mm — derivado de `el.svgPath`
 * (retângulo em page-px do tldraw, ver rectToSvgPath e o overlay do bastidor
 * em Editor.tsx), convertido via o mesmo HOOP_PX_PER_MM usado no editor.
 * É o que faz redimensionar/mover uma camada no canvas mudar de fato o
 * tamanho/posição do bordado exportado — sem isso, o desenho original
 * sempre era esticado pro bastidor INTEIRO, ignorando qualquer resize.
 */
function parseElementBoundsMm(svgPath: string | undefined): (Dimensions & { x: number; y: number }) | null {
  if (!svgPath) return null;
  const nums = (svgPath.match(/-?\d+\.?\d*/g) ?? []).map(Number);
  if (nums.length < 8) return null;
  const xs = [nums[0]!, nums[2]!, nums[4]!, nums[6]!];
  const ys = [nums[1]!, nums[3]!, nums[5]!, nums[7]!];
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  if (!(maxX > minX) || !(maxY > minY)) return null;
  return {
    x: minX / HOOP_PX_PER_MM,
    y: minY / HOOP_PX_PER_MM,
    width: (maxX - minX) / HOOP_PX_PER_MM,
    height: (maxY - minY) / HOOP_PX_PER_MM,
  };
}

/**
 * Extrai todos os <path> do SVG gerado pela IA, preserva suas cores originais
 * e sobrescreve/adiciona os atributos inkstitch com as configurações do elemento.
 *
 * As coordenadas de "d" são reescaladas do viewBox do SVG da IA para o
 * bounding box do ELEMENTO dentro do canvas (em mm) — contain-fit dentro da
 * área que o usuário posicionou/redimensionou no editor, não o bastidor
 * inteiro. Sem `el.svgPath` válido (elemento legado, sem bbox conhecido),
 * cai de volta pro bastidor inteiro.
 */
function extractAndAnnotatePaths(el: EmbroideryElement, canvas: CanvasSize): string {
  const svg = el.svgContent ?? "";
  const stitchAttrs = buildStitchAttributes(el);

  const sourceDims = parseViewBoxDimensions(svg);
  const elementBounds = parseElementBoundsMm(el.svgPath);
  const transform = sourceDims
    ? (() => {
        const target = elementBounds ?? { width: canvas.widthMm, height: canvas.heightMm };
        const fit = computeContainTransform(sourceDims, target);
        return elementBounds
          ? { scale: fit.scale, offsetX: fit.offsetX + elementBounds.x, offsetY: fit.offsetY + elementBounds.y }
          : fit;
      })()
    : null;

  // Rotação vai POR PATH (ponto:rotation*) — o worker lê só atributos de
  // <path> (svg2paths2 ignora transform/viewBox, inclusive em <g>) e aplica
  // Path.rotated() antes de gerar os pontos.
  const rotAttrs = rotationAttrs(el, elementBounds);

  const paths = extractPathParts(svg).map(({ cleanAttrs, d }) => {
    const scaledD = transform ? scalePathData(d, transform.scale, transform.offsetX, transform.offsetY) : d;
    return `<path ${cleanAttrs} d="${escapeXml(scaledD)}" fill="${el.color}" stroke="none" ${stitchAttrs}${rotAttrs} />`;
  });

  if (paths.length === 0) {
    // Fallback: nenhum path encontrado, usa bounding box do canvas como retângulo
    return elementToSvgPath(el);
  }

  return `<g id="${el.id}">\n    ${paths.join("\n    ")}\n  </g>`;
}

/**
 * Atributos `ponto:rotation*` do elemento: rotação em graus + centro (em mm,
 * centro do bbox salvo pelo editor — que guarda o retângulo NÃO rotacionado,
 * então o centro aqui coincide com o centro de rotação do shape no tldraw).
 * Emitidos por <path> porque o worker não enxerga atributos de <g>.
 */
function rotationAttrs(
  el: EmbroideryElement,
  elementBounds: (Dimensions & { x: number; y: number }) | null
): string {
  const rotation = el.rotation ?? 0;
  if (rotation === 0) return "";
  const centerX = (elementBounds?.x ?? 0) + (elementBounds?.width ?? 0) / 2;
  const centerY = (elementBounds?.y ?? 0) + (elementBounds?.height ?? 0) / 2;
  const angleDeg = +((rotation * 180) / Math.PI).toFixed(4);
  return ` ponto:rotation="${angleDeg}" ponto:rotation_cx="${+centerX.toFixed(3)}" ponto:rotation_cy="${+centerY.toFixed(3)}"`;
}

/**
 * Monta o SVG-entrada do PREVIEW de um elemento: paths anotados com inkstitch,
 * mantendo o viewBox ORIGINAL (sem reescala mm) para o preview sobrepor o shape
 * no canvas sem distorção. A densidade (line_distance) é convertida das mm para
 * as unidades do viewBox, para o espaçamento visual bater com o do bordado real.
 */
export function buildElementPreviewSvg(el: EmbroideryElement, canvas: CanvasSize): string {
  const svg = el.svgContent ?? "";
  const dims = parseViewBoxDimensions(svg);
  const viewBox = extractViewBox(svg) ?? `0 0 ${canvas.widthMm} ${canvas.heightMm}`;

  const unitsPerMm = dims && canvas.widthMm > 0 ? dims.width / canvas.widthMm : 1;
  const lineDistanceUnits = +(densityToMm(el.stitch.density, el.stitch.type) * unitsPerMm).toFixed(3);
  const stitchAttrs = buildStitchAttributes(el, lineDistanceUnits);

  const paths = extractPathParts(svg).map(
    ({ cleanAttrs, d }) =>
      `<path ${cleanAttrs} d="${escapeXml(d)}" fill="${el.color}" stroke="none" ${stitchAttrs} />`
  );

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkstitch="http://inkstitch.org/namespace" viewBox="${viewBox}">
  <g id="${el.id}">
    ${paths.join("\n    ")}
  </g>
</svg>`;
}

function extractViewBox(svg: string): string | null {
  return /viewBox=["']([^"']+)["']/i.exec(svg)?.[1] ?? null;
}

function elementToSvgPath(el: EmbroideryElement): string {
  const stitchAttrs = buildStitchAttributes(el);
  const rawD = el.svgPath || "M 0 0";
  // shapes desenhadas no tldraw (retângulo/elipse/desenho livre) guardam "d"
  // em page-px — mesma conversão pra mm usada em extractAndAnnotatePaths.
  const d = scalePathData(rawD, 1 / HOOP_PX_PER_MM, 0, 0);
  const rotAttrs = rotationAttrs(el, parseElementBoundsMm(el.svgPath));

  return `<g id="${el.id}">
    <path
      d="${escapeXml(d)}"
      fill="${el.color}"
      stroke="none"
      ${stitchAttrs}${rotAttrs}
    />
  </g>`;
}

/**
 * Atributos inkstitch:* do ponto — nomes e formato de valor CONFERIDOS
 * empiricamente contra o binário real do Ink/Stitch v3.2.2 (worker.py roda
 * o binário via subprocess, não um motor caseiro — ver inkstitch_runner.py):
 *   - valores são SEMPRE número puro, SEM sufixo "mm" — Ink/Stitch faz
 *     `float(attr)` direto; "0.4mm" falha o parse e ele volta pro default
 *     dele (silencioso, sem erro) — testado: line_distance/underlay/
 *     max_stitch_length com nome ANTIGO ou com sufixo "mm" eram 100%
 *     ignorados (contagem de pontos idêntica variando o valor);
 *   - o nome do parâmetro é `row_spacing_mm` (não `line_distance`) pro
 *     espaçamento entre linhas do preenchimento (fill_stitch.py);
 *   - `fill_underlay` (não `underlay`) é o toggle de underlay — e o DEFAULT
 *     do Ink/Stitch é `true`, então precisa emitir `false` explícito quando
 *     o usuário desliga (omitir o atributo não desliga nada);
 *   - `max_stitch_length_mm` (não `max_stitch_length`) é o comprimento
 *     máximo do ponto ao longo da linha;
 *   - `running_stitch_length_mm` (não `running_stitch_length`) já estava
 *     quase certo, só faltava o sufixo `_mm` no NOME do atributo.
 * `lineDistanceOverride` (preview): mesmo valor mas nas unidades do viewBox
 * em vez de mm (ver buildElementPreviewSvg) — Ink/Stitch não sabe a diferença,
 * só lê o número; o preview aceita essa aproximação pra não distorcer o
 * desenho sobreposto no canvas.
 */
function buildStitchAttributes(el: EmbroideryElement, lineDistanceOverride?: number): string {
  const { type, angle, underlay, pullCompensationMm } = el.stitch;
  const isPreview = lineDistanceOverride !== undefined;
  const rowSpacing = lineDistanceOverride ?? densityToMm(el.stitch.density, type);
  let base = `inkstitch:angle="${angle}"`;

  // STI-3: underlay e pull compensation só fazem sentido em preenchimentos
  // (satin/tatami); running é uma linha de contorno, sem tração lateral.
  if (type !== "running") {
    base += ` inkstitch:fill_underlay="${underlay ? "true" : "false"}"`;
    if (pullCompensationMm && pullCompensationMm > 0) {
      base += ` inkstitch:pull_compensation_mm="${pullCompensationMm}"`;
    }
  }

  // Comprimento máx. do ponto AO LONGO da linha (tatami/satin) — distinto do
  // espaçamento entre linhas. Só no export (mm reais): no preview as
  // coordenadas estão em unidades do viewBox e o default do Ink/Stitch serve.
  const maxLen = !isPreview && type !== "running" ? ` inkstitch:max_stitch_length_mm="3"` : "";

  switch (type) {
    case "satin":
      // contour_fill → zigue-zague borda-a-borda no worker (STI-2); preview e
      // export usam o mesmo método pro que se vê bater com o que se borda.
      return `${base} inkstitch:fill_method="contour_fill" inkstitch:row_spacing_mm="${rowSpacing}"${maxLen}`;
    case "tatami":
      return `${base} inkstitch:fill_method="tatami_fill" inkstitch:row_spacing_mm="${rowSpacing}"${maxLen}`;
    case "running":
      return `${base} inkstitch:stroke_method="running_stitch" inkstitch:running_stitch_length_mm="${rowSpacing}"`;
    default:
      return base;
  }
}

/**
 * density (0–1, slider da UI) → mm, por tipo de ponto. Faixas calibradas nos
 * defaults do Ink/Stitch:
 *   - tatami: espaçamento entre linhas 1.0→0.25mm (default 0.25; a faixa
 *     antiga 3.0→0.3 deixava o meio do slider com vãos visíveis e fazia o
 *     underlay aparecer através do preenchimento — efeito "duas agulhas");
 *   - satin: passo do zigue-zague 0.8→0.2mm (default Ink/Stitch 0.4);
 *   - running: comprimento do ponto 3.5→1.5mm (default 2.5).
 */
function densityToMm(density: number, type: StitchType = "tatami"): number {
  const ranges: Record<StitchType, [min: number, max: number]> = {
    tatami: [0.25, 1.0],
    satin: [0.2, 0.8],
    running: [1.5, 3.5],
  };
  const [min, max] = ranges[type] ?? ranges.tatami;
  return +(max - density * (max - min)).toFixed(2);
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
