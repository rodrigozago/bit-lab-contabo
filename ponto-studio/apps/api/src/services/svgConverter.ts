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
function extractAndAnnotatePaths(el: EmbroideryElement, canvas: CanvasSize): string {
  const svg = el.svgContent ?? "";
  const stitchAttrs = buildStitchAttributes(el);

  const sourceDims = parseViewBoxDimensions(svg);
  const transform = sourceDims
    ? computeContainTransform(sourceDims, { width: canvas.widthMm, height: canvas.heightMm })
    : null;

  // Extrai todos os <path ...> do SVG
  const pathRegex = /<path([^>]*)\/?>/gi;
  const paths: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = pathRegex.exec(svg)) !== null) {
    // normaliza espaços/quebras de linha e remove a barra do self-closing
    const attrs = (match[1] ?? "").replace(/\s+/g, " ").replace(/\/\s*$/, "");

    // Pega a cor fill do path original (se existir), senão usa a cor do elemento
    const fillMatch = /fill=["']([^"']+)["']/i.exec(attrs);
    const fill = fillMatch ? fillMatch[1] : el.color;

    // (?<![a-zA-Z]) evita casar o "d=" de dentro de id="..." (a IA sempre
    // gera id antes de d no path, ex: <path id="heart_fill" ... d="M100...")
    const dMatch = /(?<![a-zA-Z])d=["']([^"']+)["']/i.exec(attrs);
    const d = transform && dMatch
      ? scalePathData(dMatch[1]!, transform.scale, transform.offsetX, transform.offsetY)
      : (dMatch?.[1] ?? "");

    // Remove atributos inkstitch/fill/stroke/d existentes para reescrever com
    // os do elemento (evita atributos duplicados, que quebram o parser XML)
    const cleanAttrs = attrs
      .replace(/inkstitch:[a-z_]+=["'][^"']*["']/gi, "")
      .replace(/fill=["'][^"']*["']/gi, "")
      .replace(/stroke=["'][^"']*["']/gi, "")
      .replace(/(?<![a-zA-Z])d=["'][^"']*["']/gi, "")
      .replace(/\s+/g, " ")
      .trim();

    paths.push(
      `<path ${cleanAttrs} d="${escapeXml(d)}" fill="${fill}" stroke="none" ${stitchAttrs} />`
    );
  }

  if (paths.length === 0) {
    // Fallback: nenhum path encontrado, usa bounding box do canvas como retângulo
    return elementToSvgPath(el);
  }

  return `<g id="${el.id}">\n    ${paths.join("\n    ")}\n  </g>`;
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

function buildStitchAttributes(el: EmbroideryElement): string {
  const { type, density, angle } = el.stitch;
  const lineDistance = densityToMm(density);
  const base = `inkstitch:angle="${angle}"`;

  switch (type) {
    case "satin":
      return `${base} inkstitch:fill_method="contour_fill" inkstitch:contour_strategy="inner_to_outer"`;
    case "tatami":
      return `${base} inkstitch:fill_method="tatami_fill" inkstitch:line_distance="${lineDistance}mm"`;
    case "running":
      return `${base} inkstitch:stroke_method="running_stitch" inkstitch:running_stitch_length="${lineDistance}mm"`;
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
