import type { EmbroideryElement } from "@ponto-studio/shared";

/**
 * Separa um SVG em camadas por cor: todos os <path> com o mesmo fill
 * (mesmo desconectados ou espalhados em grupos) viram UM documento SVG
 * próprio — uma camada de bordado por cor/linha.
 *
 * Funciona tanto com o SVG do worker local (paths agrupados em <g fill>)
 * quanto com o SVG da IA (paths soltos com fill próprio).
 */

export interface ColorLayer {
  /** cor normalizada (#rrggbb quando possível) */
  color: string;
  /** documento SVG completo contendo apenas os paths desta cor */
  svgContent: string;
}

const DEFAULT_FILL = "#000000";

/** Normaliza fills para #rrggbb minúsculo; rgb(...) é convertido; outros valores passam intactos. */
export function normalizeColor(value: string | null | undefined): string {
  if (!value || value === "none") return DEFAULT_FILL;
  const v = value.trim().toLowerCase();

  const hexMatch = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(v);
  if (hexMatch) {
    const hex = hexMatch[1]!;
    const full = hex.length === 3 ? hex.split("").map((c) => c + c).join("") : hex;
    return `#${full}`;
  }

  const rgbMatch = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(v);
  if (rgbMatch) {
    const toHex = (s: string) => Math.min(255, Number(s)).toString(16).padStart(2, "0");
    return `#${toHex(rgbMatch[1]!)}${toHex(rgbMatch[2]!)}${toHex(rgbMatch[3]!)}`;
  }

  return v; // cor nomeada etc. — usada como veio
}

/** Fill efetivo de um path: atributo próprio, senão herdado do ancestral mais próximo. */
function effectiveFill(el: Element): string {
  let node: Element | null = el;
  while (node && node.tagName.toLowerCase() !== "svg") {
    const fill = node.getAttribute("fill");
    if (fill) return normalizeColor(fill);
    const style = node.getAttribute("style");
    const styleFill = style && /fill:\s*([^;]+)/.exec(style)?.[1];
    if (styleFill) return normalizeColor(styleFill);
    node = node.parentElement;
  }
  return DEFAULT_FILL;
}

/**
 * Substitui o fill de todos os elementos (path, g, ...) de um SVG por uma
 * cor nova — usado pra recolorir o preview no canvas quando o usuário muda
 * a "Cor do fio" no painel de propriedades (o asset da shape no tldraw é
 * uma imagem estática, então precisa ser regenerado pra refletir a mudança).
 */
export function recolorSvg(svg: string, newColor: string): string {
  const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
  const docEl = doc.documentElement as Element | undefined;
  const root = docEl && docEl.tagName?.toLowerCase() === "svg" ? docEl : doc.querySelector("svg");
  if (!root) return svg;

  for (const el of Array.from(root.querySelectorAll("[fill]"))) {
    el.setAttribute("fill", newColor);
  }
  if (root.hasAttribute("fill")) root.setAttribute("fill", newColor);

  return new XMLSerializer().serializeToString(root);
}

/**
 * Compõe uma miniatura de um projeto inteiro empilhando os elementos (cada um
 * já recolorido pra `el.color`, a cor de fio atual) num único SVG — usado nos
 * cards da Home (lista de projetos), sem nenhum round-trip novo à API: os
 * elementos já vêm completos em `GET /api/projects`.
 */
export function composeThumbnail(elements: EmbroideryElement[]): string | null {
  const withSvg = elements.filter((el): el is EmbroideryElement & { svgContent: string } => !!el.svgContent);
  if (withSvg.length === 0) return null;

  const parser = new DOMParser();
  const serializer = new XMLSerializer();

  let viewBox: string | null = null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const innerParts: string[] = [];

  for (const el of withSvg) {
    const recolored = recolorSvg(el.svgContent, el.color);
    const doc = parser.parseFromString(recolored, "image/svg+xml");
    const docEl = doc.documentElement as Element | undefined;
    const root = docEl && docEl.tagName?.toLowerCase() === "svg" ? docEl : doc.querySelector("svg");
    if (!root) continue;

    if (!viewBox) viewBox = root.getAttribute("viewBox");

    // Calcula o bounding box dos paths para detectar se há overflow
    for (const path of Array.from(root.querySelectorAll("path"))) {
      try {
        const bbox = path.getBBox?.();
        if (bbox) {
          minX = Math.min(minX, bbox.x);
          minY = Math.min(minY, bbox.y);
          maxX = Math.max(maxX, bbox.x + bbox.width);
          maxY = Math.max(maxY, bbox.y + bbox.height);
        }
      } catch {
        // Se getBBox falhar, ignora
      }
    }

    for (const child of Array.from(root.children)) {
      innerParts.push(serializer.serializeToString(child));
    }
  }

  if (innerParts.length === 0) return null;

  const finalViewBox = viewBox ?? "0 0 100 100";

  // Se há overflow detectado, ajusta o viewBox para o bounding box real
  let adjustedViewBox = finalViewBox;
  if (isFinite(minX) && isFinite(minY) && isFinite(maxX) && isFinite(maxY)) {
    const width = maxX - minX || 100;
    const height = maxY - minY || 100;
    adjustedViewBox = `${minX} ${minY} ${width} ${height}`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${adjustedViewBox}" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" style="display:block;">${innerParts.join("")}</svg>`;
}

export function splitSvgByColor(svg: string): ColorLayer[] {
  const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
  // documentElement é o caminho normal; happy-dom (testes) não o popula em
  // documentos XML, então caímos pro querySelector.
  const docEl = doc.documentElement as Element | undefined;
  const root = docEl && docEl.tagName?.toLowerCase() === "svg" ? docEl : doc.querySelector("svg");
  if (!root) return [];

  const byColor = new Map<string, Element[]>();
  for (const path of Array.from(doc.querySelectorAll("path"))) {
    const color = effectiveFill(path);
    if (!byColor.has(color)) byColor.set(color, []);
    byColor.get(color)!.push(path);
  }

  // Atributos do root preservados em cada camada (viewBox, dimensões, namespaces)
  const rootAttrs = Array.from(root.attributes)
    .map((a) => `${a.name}="${a.value}"`)
    .join(" ");

  const serializer = new XMLSerializer();
  const layers: ColorLayer[] = [];

  for (const [color, paths] of byColor) {
    const pathsXml = paths
      .map((p) => {
        const clone = p.cloneNode(true) as Element;
        clone.setAttribute("fill", color);
        clone.removeAttribute("style");
        return serializer.serializeToString(clone);
      })
      .join("\n    ");

    layers.push({
      color,
      svgContent: `<svg ${rootAttrs}>\n  <g fill="${color}">\n    ${pathsXml}\n  </g>\n</svg>`,
    });
  }

  return layers;
}
