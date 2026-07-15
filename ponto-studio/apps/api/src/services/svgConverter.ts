import type { EmbroideryProject, EmbroideryElement, CanvasSize } from "@ponto-studio/shared";
import { parseViewBoxDimensions, computeContainTransform, scalePathData } from "./svgTransform.js";

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
  /** cor fill do path (ou fallback) */
  fill: string;
  /** atributo "d" cru */
  d: string;
}

/** Extrai os <path> de um SVG, separando attrs limpos, fill e d. Reusado por export e preview. */
function extractPathParts(svg: string, fillFallback: string): PathPart[] {
  const pathRegex = /<path([^>]*)\/?>/gi;
  const parts: PathPart[] = [];
  let match: RegExpExecArray | null;

  while ((match = pathRegex.exec(svg)) !== null) {
    // normaliza espaços/quebras de linha e remove a barra do self-closing
    const attrs = (match[1] ?? "").replace(/\s+/g, " ").replace(/\/\s*$/, "");
    const fillMatch = /fill=["']([^"']+)["']/i.exec(attrs);
    // (?<![a-zA-Z]) evita casar o "d=" de dentro de id="..." (a IA gera id antes de d)
    const dMatch = /(?<![a-zA-Z])d=["']([^"']+)["']/i.exec(attrs);

    const cleanAttrs = attrs
      .replace(/inkstitch:[a-z_]+=["'][^"']*["']/gi, "")
      .replace(/fill=["'][^"']*["']/gi, "")
      .replace(/stroke=["'][^"']*["']/gi, "")
      .replace(/(?<![a-zA-Z])d=["'][^"']*["']/gi, "")
      .replace(/\s+/g, " ")
      .trim();

    parts.push({ cleanAttrs, fill: fillMatch ? fillMatch[1]! : fillFallback, d: dMatch?.[1] ?? "" });
  }

  return parts;
}

/**
 * Extrai todos os <path> do SVG gerado pela IA, preserva suas cores originais
 * e sobrescreve/adiciona os atributos inkstitch com as configurações do elemento.
 *
 * As coordenadas de "d" são reescaladas do viewBox do SVG da IA para o canvas
 * do projeto (em mm) — necessário porque o worker de bordado lê os números
 * crus de "d" como milímetros e ignora viewBox/transform de contêiner.
 */
function extractAndAnnotatePaths(el: EmbroideryElement, canvas: CanvasSize): string {
  const svg = el.svgContent ?? "";
  const stitchAttrs = buildStitchAttributes(el);

  const sourceDims = parseViewBoxDimensions(svg);
  const transform = sourceDims
    ? computeContainTransform(sourceDims, { width: canvas.widthMm, height: canvas.heightMm })
    : null;

  const paths = extractPathParts(svg, el.color).map(({ cleanAttrs, fill, d }) => {
    const scaledD = transform ? scalePathData(d, transform.scale, transform.offsetX, transform.offsetY) : d;
    return `<path ${cleanAttrs} d="${escapeXml(scaledD)}" fill="${fill}" stroke="none" ${stitchAttrs} />`;
  });

  if (paths.length === 0) {
    // Fallback: nenhum path encontrado, usa bounding box do canvas como retângulo
    return elementToSvgPath(el);
  }

  return `<g id="${el.id}">\n    ${paths.join("\n    ")}\n  </g>`;
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
  const lineDistanceUnits = +(densityToMm(el.stitch.density) * unitsPerMm).toFixed(3);
  const stitchAttrs = buildStitchAttributes(el, lineDistanceUnits);

  const paths = extractPathParts(svg, el.color).map(
    ({ cleanAttrs, fill, d }) =>
      `<path ${cleanAttrs} d="${escapeXml(d)}" fill="${fill}" stroke="none" ${stitchAttrs} />`
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
  const d = el.svgPath || "M 0 0";
  return `<path
    id="${el.id}"
    d="${escapeXml(d)}"
    fill="${el.color}"
    stroke="none"
    ${stitchAttrs}
  />`;
}

/**
 * Atributos inkstitch do ponto. Por padrão usa mm (export, que reescala o SVG
 * para o canvas em mm). Se `lineDistanceOverride` for passado (preview), usa
 * esse valor nas unidades do viewBox e força line_distance mesmo no satin —
 * assim o worker tem um espaçamento sensato no espaço de coordenadas original.
 */
function buildStitchAttributes(el: EmbroideryElement, lineDistanceOverride?: number): string {
  const { type, angle } = el.stitch;
  const isPreview = lineDistanceOverride !== undefined;
  const lineDistance = lineDistanceOverride ?? densityToMm(el.stitch.density);
  const suffix = isPreview ? "" : "mm";
  const base = `inkstitch:angle="${angle}"`;

  switch (type) {
    case "satin":
      // O worker hoje não tem um algoritmo de coluna dedicado pro contour_fill
      // (STI-2) — cai no mesmo preenchimento par-ímpar do tatami — mas density
      // tem que valer igual, senão o slider fica sem nenhum efeito no cetim.
      return isPreview
        ? `${base} inkstitch:fill_method="tatami_fill" inkstitch:line_distance="${lineDistance}"`
        : `${base} inkstitch:fill_method="contour_fill" inkstitch:contour_strategy="inner_to_outer" inkstitch:line_distance="${lineDistance}${suffix}"`;
    case "tatami":
      return `${base} inkstitch:fill_method="tatami_fill" inkstitch:line_distance="${lineDistance}${suffix}"`;
    case "running":
      return `${base} inkstitch:stroke_method="running_stitch" inkstitch:running_stitch_length="${lineDistance}${suffix}"`;
    default:
      return base;
  }
}

function densityToMm(density: number): number {
  const min = 0.3;
  const max = 3.0;
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
