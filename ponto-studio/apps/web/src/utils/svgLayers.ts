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
