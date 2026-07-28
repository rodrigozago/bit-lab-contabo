import { HOOP_PX_PER_MM, STROKE_FAMILY_STITCH_TYPES as STROKE_FAMILY_TYPES, type EmbroideryProject, type EmbroideryElement, type CanvasSize } from "@ponto-studio/shared";
import { parseViewBoxDimensions, computeContainTransform, scalePathData, rotatePathData, flattenPathData, type Dimensions } from "./svgTransform.js";
import { extractSatinRails, type RailPair } from "./satinRails.js";

/**
 * Converte um EmbroideryProject em SVG compatível com pyembroidery/Ink/Stitch.
 *
 * Cada EmbroideryElement pode ter:
 *   - svgContent: SVG completo gerado pela IA → extrai os <path> de dentro
 *   - svgPath: atributo "d" de um path simples (shapes do tldraw)
 *
 * `warnings` (opcional) recebe avisos não-bloqueantes sobre o resultado (ex.:
 * Cetim que não coube numa parte e caiu pro Tatami) — quem chama decide se
 * repassa isso pro usuário (ver rotas de export/preview).
 */
export function convertProjectToSvg(project: EmbroideryProject, warnings?: string[]): string {
  const { canvas, elements, name } = project;

  const elementsSvg = elements.map((el) => elementToSvgGroup(el, canvas, warnings)).join("\n  ");

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

function elementToSvgGroup(el: EmbroideryElement, canvas: CanvasSize, warnings?: string[]): string {
  if (el.stitch.type === "satinColumn") {
    // Formas simples (sem svgContent): trilhos triviais a partir do bbox
    // retangular (Fase 3). Formas complexas (svgContent, vindas de
    // importação de imagem): extração geral de polígono (Fase 4, ver
    // satinRails.ts) — achata as curvas, acha o eixo principal e divide o
    // contorno em 2 trilhos, aplicando na região de MAIOR ÁREA quando há mais
    // de uma (ver satinColumnFromComplexShape). Em QUALQUER caso a extração
    // pode falhar de vez (forma pouco alongada, geometria degenerada) — cai
    // pro tatami com a mesma densidade, mantendo a geometria original.
    const partName = el.name?.trim() || `parte ${el.color}`;
    if (el.svgContent) {
      const result = satinColumnFromComplexShape(el, canvas);
      if (result) {
        if (result.multiRegion) {
          warnings?.push(`Cetim em "${partName}": aplicado só na maior região — as demais usam Tatami.`);
        }
        return result.svg;
      }
    } else {
      const satinSvg = satinColumnToSvgGroup(el);
      if (satinSvg) return satinSvg;
    }
    warnings?.push(`Cetim em "${partName}": a forma não coube num cetim de verdade — usando Tatami.`);
    return elementToSvgGroupByShape({ ...el, stitch: { type: "tatami", density: el.stitch.density, angle: 45 } }, canvas);
  }
  return elementToSvgGroupByShape(el, canvas);
}

function elementToSvgGroupByShape(el: EmbroideryElement, canvas: CanvasSize): string {
  // Se tem SVG completo da IA, extrai os paths de dentro e reaplica atributos inkstitch
  if (el.svgContent && el.svgContent.trim().startsWith("<")) {
    return extractAndAnnotatePaths(el, canvas);
  }
  // Caso simples: svgPath é o atributo "d"
  return elementToSvgPath(el);
}

/**
 * Constrói os 2 trilhos (rails) do cetim a partir do bounding box retangular
 * de uma forma simples (ver `parseElementBoundsMm`) — os 2 lados MAIS
 * COMPRIDOS do retângulo viram os 2 trilhos (o zigue-zague atravessa o lado
 * mais curto). `null` se não houver bounds válidos (sem `svgPath` utilizável).
 */
function satinColumnToSvgGroup(el: EmbroideryElement): string | null {
  const bounds = parseElementBoundsMm(el.svgPath);
  if (!bounds || !(bounds.width > 0) || !(bounds.height > 0)) return null;
  const { x, y, width, height } = bounds;

  // Cada trilho percorre a MESMA direção (ex.: os dois da esquerda pra
  // direita) — pareamento por índice do Ink/Stitch (old-style, sem rungs)
  // conecta o ponto 0 de um trilho com o ponto 0 do outro, senão o
  // zigue-zague sai cruzado.
  const rawD = width >= height
    ? `M ${x} ${y} L ${x + width} ${y} M ${x} ${y + height} L ${x + width} ${y + height}`
    : `M ${x} ${y} L ${x} ${y + height} M ${x + width} ${y} L ${x + width} ${y + height}`;

  const centerX = x + width / 2;
  const centerY = y + height / 2;
  const angleDeg = ((el.rotation ?? 0) * 180) / Math.PI;
  const d = rotatePathData(rawD, angleDeg, centerX, centerY);
  const { presentation, inkstitch } = buildStitchAttributes(el);

  return `<g id="${el.id}">
    <path
      d="${escapeXml(d)}"
      ${presentation}
      ${inkstitch}
    />
  </g>`;
}

/**
 * Área (shoelace, valor absoluto) de um polígono já achatado em polilinha —
 * usada só pra ESCOLHER a maior região entre candidatas ao cetim (não
 * precisa do sinal, que indicaria sentido horário/anti-horário).
 */
function polygonArea(points: Array<[number, number]>): number {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i]!;
    const [x2, y2] = points[(i + 1) % points.length]!;
    sum += x1 * y2 - x2 * y1;
  }
  return Math.abs(sum) / 2;
}

/**
 * Constrói os 2 trilhos do cetim a partir da geometria REAL de um elemento
 * com `svgContent` (polígono arbitrário vindo de importação de imagem) — ver
 * `satinRails.ts` (Fase 4) pro algoritmo (PCA + split + reamostragem). A
 * parte pode ter mais de 1 `<path>` (regiões desconectadas da mesma cor —
 * comum, é assim que `splitSvgByColor` agrupa fotos/logos) ou um path
 * composto que achata em mais de 1 subcaminho (path com buraco); nesses
 * casos, o cetim aplica na região de MAIOR ÁREA entre todas as candidatas —
 * as demais ficam de fora do cetim (a parte inteira ainda cai pro fallback
 * tatami se nem a maior render um trilho válido — forma pouco alongada ou
 * degenerada). `multiRegion` avisa o chamador que houve descarte de região,
 * pra emitir um aviso explícito pro usuário em vez de silencioso.
 */
function satinColumnFromComplexShape(
  el: EmbroideryElement,
  canvas: CanvasSize
): { svg: string; multiRegion: boolean } | null {
  const svg = el.svgContent ?? "";
  const parts = extractPathParts(svg);
  if (parts.length === 0) return null;

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

  // Achata CADA path candidato e escolhe o subcaminho de maior área entre
  // TODOS (de todos os paths) — cobre tanto múltiplos <path> (regiões soltas)
  // quanto um único path composto com múltiplos subcaminhos (buraco).
  let bestSubpath: Array<[number, number]> | null = null;
  let bestArea = -1;
  let candidateCount = 0;
  for (const part of parts) {
    const scaledD = transform ? scalePathData(part.d, transform.scale, transform.offsetX, transform.offsetY) : part.d;
    const flattened = flattenPathData(scaledD);
    for (const subpath of flattened) {
      candidateCount++;
      const area = polygonArea(subpath);
      if (area > bestArea) {
        bestArea = area;
        bestSubpath = subpath;
      }
    }
  }
  if (!bestSubpath) return null;

  const rails = extractSatinRails(bestSubpath);
  if (!rails) return null;

  const centerX = (elementBounds?.x ?? 0) + (elementBounds?.width ?? 0) / 2;
  const centerY = (elementBounds?.y ?? 0) + (elementBounds?.height ?? 0) / 2;
  const angleDeg = ((el.rotation ?? 0) * 180) / Math.PI;
  const d = rotatePathData(railsToPathData(rails), angleDeg, centerX, centerY);
  const { presentation, inkstitch } = buildStitchAttributes(el);

  const svgFragment = `<g id="${el.id}">
    <path
      d="${escapeXml(d)}"
      ${presentation}
      ${inkstitch}
    />
  </g>`;
  return { svg: svgFragment, multiRegion: candidateCount > 1 };
}

function railsToPathData(rails: RailPair): string {
  const railToD = (pts: RailPair["rail1"]) =>
    "M " + pts.map(([x, y], i) => (i === 0 ? `${x} ${y}` : `L ${x} ${y}`)).join(" ");
  return `${railToD(rails.rail1)} ${railToD(rails.rail2)}`;
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
 * (page-px do tldraw, ver geometry.ts e o overlay do bastidor em Editor.tsx),
 * convertido via o mesmo HOOP_PX_PER_MM usado no editor. Funciona pra
 * QUALQUER polígono (retângulo, elipse poligonalizada, traço livre) — min/max
 * sobre TODOS os pares de coordenadas do `d`, não só os 4 primeiros (formas
 * nativas do editor só emitem M/L/Z, nunca curvas/arcos, então não precisa de
 * `flattenPathData` aqui — isso já é feito à parte pra `svgContent` vindo de
 * importação de imagem, que pode ter curvas). É o que faz redimensionar/mover
 * uma camada no canvas mudar de fato o tamanho/posição do bordado exportado —
 * sem isso, o desenho original sempre era esticado pro bastidor INTEIRO,
 * ignorando qualquer resize.
 */
function parseElementBoundsMm(svgPath: string | undefined): (Dimensions & { x: number; y: number }) | null {
  if (!svgPath) return null;
  const nums = (svgPath.match(/-?\d+\.?\d*/g) ?? []).map(Number);
  if (nums.length < 4) return null;
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i + 1 < nums.length; i += 2) {
    xs.push(nums[i]!);
    ys.push(nums[i + 1]!);
  }
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
  const { presentation, inkstitch } = buildStitchAttributes(el);

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

  // Rotação embutida DIRETO nas coordenadas do "d" (não como atributo custom
  // tipo "ponto:rotation") — o Ink/Stitch ignora qualquer atributo que não
  // reconheça (confirmado: não dá erro nem aviso, só não faz nada), então a
  // rotação PRECISA estar na geometria em si. Rotaciona em torno do centro do
  // bbox salvo pelo editor (bbox NÃO-rotacionado — coincide com o centro de
  // rotação do shape no tldraw). Aplicada DEPOIS do contain-fit pro canvas
  // (mesmo espaço de coordenadas — mm — que o bbox/centro já estão).
  const angleDeg = ((el.rotation ?? 0) * 180) / Math.PI;
  const centerX = (elementBounds?.x ?? 0) + (elementBounds?.width ?? 0) / 2;
  const centerY = (elementBounds?.y ?? 0) + (elementBounds?.height ?? 0) / 2;

  const paths = extractPathParts(svg).map(({ cleanAttrs, d }) => {
    const scaledD = transform ? scalePathData(d, transform.scale, transform.offsetX, transform.offsetY) : d;
    const finalD = rotatePathData(scaledD, angleDeg, centerX, centerY);
    return `<path ${cleanAttrs} d="${escapeXml(finalD)}" ${presentation} ${inkstitch} />`;
  });

  if (paths.length === 0) {
    // Fallback: nenhum path encontrado, usa bounding box do canvas como retângulo
    return elementToSvgPath(el);
  }

  return `<g id="${el.id}">\n    ${paths.join("\n    ")}\n  </g>`;
}

/**
 * Monta o SVG-entrada do PREVIEW de um elemento pro Ink/Stitch — rodando no
 * TAMANHO FÍSICO REAL da parte (bbox em mm do `svgPath`), pelo MESMO caminho
 * de conversão do export (`elementToSvgGroup`, a mesma função que
 * `convertProjectToSvg` usa por elemento) — inclusive a extração real dos 2
 * trilhos do Cetim (`satinColumnFromComplexShape`/`satinColumnToSvgGroup`),
 * que esta função NUNCA fazia antes (montava os `<path>` manualmente, sem
 * passar pelo dispatch de satinColumn — por isso o preview de uma parte
 * "Cetim" podia divergir do resultado real do export). Pra reusar o mesmo
 * código sem duplicar a lógica de bounds/rotação, construímos um elemento
 * SINTÉTICO — mesmíssimo elemento, mas com `svgPath` reescrito pra um
 * retângulo na ORIGEM (0,0) do tamanho físico real da parte (em vez do
 * offset dela dentro do canvas) e `rotation` zerada:
 *  - isolado na origem, com `viewBox="0 0 Wmm Hmm"` do próprio bbox, pra o
 *    preview de pontos que volta do worker sobrepor o shape 1:1 no canvas;
 *  - SEM embutir a rotação: o shape de imagem do tldraw já carrega a rotação,
 *    então o conteúdo do preview fica na orientação base (diferente do export,
 *    que gera o desenho final achatado e precisa da rotação na geometria).
 *
 * Por que rodar no tamanho real importa: o `viewBox` do `svgContent` está em
 * PIXELS da imagem analisada (pode ser centenas). Se a gente mandasse esse
 * viewBox como mm pro Ink/Stitch (width="200mm"...), ele geraria um desenho de
 * centenas de mm → milhares de pontos → TIMEOUT no worker. Reescalando pro
 * bbox real (ex.: 25mm), a densidade/contagem de pontos é a mesma do bordado
 * de verdade e o job roda rápido.
 */
export function buildElementPreviewSvg(el: EmbroideryElement, canvas: CanvasSize, warnings?: string[]): string {
  const bounds = parseElementBoundsMm(el.svgPath);
  // tamanho físico da parte, em mm (fallback: canvas inteiro, pra legado sem svgPath)
  const w = +(bounds?.width ?? canvas.widthMm).toFixed(3);
  const h = +(bounds?.height ?? canvas.heightMm).toFixed(3);

  const syntheticEl: EmbroideryElement = {
    ...el,
    svgPath: `M 0 0 L ${w * HOOP_PX_PER_MM} 0 L ${w * HOOP_PX_PER_MM} ${h * HOOP_PX_PER_MM} L 0 ${h * HOOP_PX_PER_MM} Z`,
    rotation: 0,
  };
  const fragment = elementToSvgGroup(syntheticEl, { widthMm: w, heightMm: h }, warnings);

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkstitch="http://inkstitch.org/namespace" width="${w}mm" height="${h}mm" viewBox="0 0 ${w} ${h}">
  ${fragment}
</svg>`;
}


function elementToSvgPath(el: EmbroideryElement): string {
  const { presentation, inkstitch } = buildStitchAttributes(el);
  const rawD = el.svgPath || "M 0 0";
  // shapes desenhadas no tldraw (retângulo/elipse/desenho livre) guardam "d"
  // em page-px — mesma conversão pra mm usada em extractAndAnnotatePaths.
  const scaledD = scalePathData(rawD, 1 / HOOP_PX_PER_MM, 0, 0);

  // Rotação embutida nas coordenadas (ver extractAndAnnotatePaths) — mesmo
  // bbox/centro do próprio svgPath, já em mm.
  const bounds = parseElementBoundsMm(el.svgPath);
  const angleDeg = ((el.rotation ?? 0) * 180) / Math.PI;
  const centerX = (bounds?.x ?? 0) + (bounds?.width ?? 0) / 2;
  const centerY = (bounds?.y ?? 0) + (bounds?.height ?? 0) / 2;
  const d = rotatePathData(scaledD, angleDeg, centerX, centerY);

  return `<g id="${el.id}">
    <path
      d="${escapeXml(d)}"
      ${presentation}
      ${inkstitch}
    />
  </g>`;
}

/**
 * Padrão de textura do meander (um dos 75 "tiles" bundlados no binário do
 * Ink/Stitch, em /opt/inkstitch/tiles/ — nomes crípticos tipo "N4-21c", sem
 * nome amigável). Sem seletor na UI por ora (Fase 1); todo elemento meander
 * usa este mesmo padrão. Confirmado válido empiricamente.
 */
const DEFAULT_MEANDER_PATTERN = "N4-21c";

/**
 * Tipos que o Ink/Stitch trata como `Stroke` (element.py: `node_to_elements`
 * cria um `FillStitch` se `fill` for != "none" e um `Stroke` se `stroke` for
 * != "none" — INDEPENDENTEMENTE um do outro, não é mutuamente exclusivo).
 * Confirmado empiricamente: um path com `fill="cor" stroke="none"` e
 * `inkstitch:stroke_method="running_stitch"` gerava 286 pontos; o MESMO path
 * com `fill="none" stroke="cor"` gerava 48 — os 238 pontos a mais eram um
 * `auto_fill` FANTASMA (default do Ink/Stitch quando `fill_method` não é
 * emitido), silenciosamente empilhado por baixo do ponto corrido. Por isso
 * estes tipos SEMPRE emitem `fill="none" stroke="cor"` (nunca os dois juntos
 * como os fills de verdade) — ver `buildStitchAttributes`. `satinColumn`
 * também entra aqui: `SatinColumn.color` (`lib/elements/satin_column.py`)
 * lê a cor do `stroke`, não do `fill`.
 */
/** density (0–1 da UI) → valor real, por faixa. Ranges calibrados nos defaults do Ink/Stitch. */
function densityToRange(density: number, [min, max]: readonly [number, number]): number {
  return +(max - density * (max - min)).toFixed(2);
}
// espaçamento entre linhas (row_spacing_mm) — tatami/contour/circular; default Ink/Stitch 0.25mm
const ROW_SPACING_RANGE_MM = [0.25, 1.0] as const;
// comprimento do ponto corrido (running_stitch_length_mm); default Ink/Stitch 2.5mm — running e ripple
const RUNNING_LENGTH_RANGE_MM = [1.5, 3.5] as const;
// escala do padrão do meandro (%), invertida: densidade alta = padrão menor = mais cobertura
const MEANDER_SCALE_RANGE_PERCENT = [50, 200] as const;
// espaçamento do ziguezague pico-a-pico (zigzag_spacing_mm); density=0.5 → 0.4mm (default Ink/Stitch)
const ZIGZAG_SPACING_RANGE_MM = [0.2, 0.6] as const;

/** Atributos de apresentação (fill/stroke/stroke-width) e inkstitch:* de um elemento. */
interface StitchSvgAttrs {
  presentation: string;
  inkstitch: string;
}

/**
 * Atributos do ponto por tipo — nomes/formato de valor CONFERIDOS
 * EMPIRICAMENTE contra o binário real do Ink/Stitch v3.2.2 (não por
 * suposição — ver docs/MOTOR-BORDADO-INKSTITCH.md, Fase 0/1/2). Cada
 * `fill_method`/`stroke_method` só lê um SUBCONJUNTO dos parâmetros: `angle`
 * e `pull_compensation_mm` só existem pra `auto_fill` (tatami); `contour_fill`
 * não lê `angle` nem `pull_compensation_mm`; `meander_fill` não lê
 * `row_spacing_mm`/`max_stitch_length_mm`; `circular_fill` não lê
 * `max_stitch_length_mm`. Valores são SEMPRE número puro, sem sufixo "mm".
 *
 * `presentation` (fill/stroke) varia por FAMÍLIA, não por tipo: os fills
 * (tatami/contour/meander/circular/satin) usam `fill=cor stroke="none"`; os
 * strokes (running/zigzag/ripple) usam `fill="none" stroke=cor` — nunca os
 * dois juntos, senão o Ink/Stitch cria um FillStitch fantasma por baixo (ver
 * `STROKE_FAMILY_TYPES`).
 *
 * `unitsPerMm`: só usado no preview (`buildElementPreviewSvg`), que mantém o
 * viewBox original do SVG (sem reescala) — converte os valores em mm pras
 * unidades desse viewBox. Não afeta atributos já adimensionais (percentual,
 * contour_strategy etc.) nem `max_stitch_length_mm` (o worker usa o default
 * dele no preview).
 */
function buildStitchAttributes(el: EmbroideryElement, unitsPerMm?: number): StitchSvgAttrs {
  const stitch = el.stitch;
  const isPreview = unitsPerMm !== undefined;
  const toViewBoxUnits = (mm: number) => (unitsPerMm ? +(mm * unitsPerMm).toFixed(3) : mm);
  const underlayAttr = (on: boolean | undefined) => `inkstitch:fill_underlay="${on ? "true" : "false"}"`;
  const presentation = STROKE_FAMILY_TYPES.has(stitch.type)
    ? `fill="none" stroke="${el.color}"` + (stitch.type === "zigzag" ? ` stroke-width="${toViewBoxUnits(stitch.widthMm)}"` : "")
    : `fill="${el.color}" stroke="none"`;

  switch (stitch.type) {
    case "tatami": {
      const rowSpacing = toViewBoxUnits(densityToRange(stitch.density, ROW_SPACING_RANGE_MM));
      let attrs = `inkstitch:fill_method="auto_fill" inkstitch:angle="${stitch.angle}" ` +
        `inkstitch:row_spacing_mm="${rowSpacing}" ${underlayAttr(stitch.underlay)}`;
      if (!isPreview) attrs += ` inkstitch:max_stitch_length_mm="3"`;
      if (stitch.pullCompensationMm && stitch.pullCompensationMm > 0) {
        attrs += ` inkstitch:pull_compensation_mm="${stitch.pullCompensationMm}"`;
      }
      return { presentation, inkstitch: attrs };
    }
    // "satin" é alias legado — mecanicamente sempre foi contour_fill (nunca
    // cetim de verdade; ver comentário em StitchParams no packages/shared).
    case "satin":
    case "contour": {
      const rowSpacing = toViewBoxUnits(densityToRange(stitch.density, ROW_SPACING_RANGE_MM));
      let attrs = `inkstitch:fill_method="contour_fill" inkstitch:row_spacing_mm="${rowSpacing}" ` +
        `${underlayAttr(stitch.underlay)}`;
      if (!isPreview) attrs += ` inkstitch:max_stitch_length_mm="3"`;
      if (stitch.type === "contour") {
        if (stitch.contourStrategy) attrs += ` inkstitch:contour_strategy="${stitch.contourStrategy}"`;
        if (stitch.avoidSelfCrossing) attrs += ` inkstitch:avoid_self_crossing="true"`;
      }
      return { presentation, inkstitch: attrs };
    }
    case "meander": {
      const scalePercent = densityToRange(stitch.density, MEANDER_SCALE_RANGE_PERCENT);
      let attrs = `inkstitch:fill_method="meander_fill" ` +
        `inkstitch:meander_pattern="${stitch.pattern ?? DEFAULT_MEANDER_PATTERN}" ` +
        `inkstitch:meander_scale_percent="${scalePercent}" ${underlayAttr(stitch.underlay)}`;
      if (stitch.angle) attrs += ` inkstitch:meander_angle="${stitch.angle}"`;
      return { presentation, inkstitch: attrs };
    }
    case "circular": {
      const rowSpacing = toViewBoxUnits(densityToRange(stitch.density, ROW_SPACING_RANGE_MM));
      return {
        presentation,
        inkstitch: `inkstitch:fill_method="circular_fill" inkstitch:row_spacing_mm="${rowSpacing}" ${underlayAttr(stitch.underlay)}`,
      };
    }
    case "running": {
      const stitchLen = toViewBoxUnits(densityToRange(stitch.density, RUNNING_LENGTH_RANGE_MM));
      let attrs = `inkstitch:stroke_method="running_stitch" inkstitch:running_stitch_length_mm="${stitchLen}"`;
      if (stitch.repeats && stitch.repeats > 1) attrs += ` inkstitch:repeats="${stitch.repeats}"`;
      if (stitch.beanStitchRepeats) attrs += ` inkstitch:bean_stitch_repeats="${stitch.beanStitchRepeats}"`;
      return { presentation, inkstitch: attrs };
    }
    case "zigzag": {
      const spacing = toViewBoxUnits(densityToRange(stitch.density, ZIGZAG_SPACING_RANGE_MM));
      let attrs = `inkstitch:stroke_method="zigzag_stitch" inkstitch:zigzag_spacing_mm="${spacing}"`;
      if (stitch.pullCompensationMm && stitch.pullCompensationMm > 0) {
        attrs += ` inkstitch:stroke_pull_compensation_mm="${stitch.pullCompensationMm}"`;
      }
      if (stitch.repeats && stitch.repeats > 1) attrs += ` inkstitch:repeats="${stitch.repeats}"`;
      return { presentation, inkstitch: attrs };
    }
    case "ripple": {
      const stitchLen = toViewBoxUnits(densityToRange(stitch.density, RUNNING_LENGTH_RANGE_MM));
      let attrs = `inkstitch:stroke_method="ripple_stitch" inkstitch:running_stitch_length_mm="${stitchLen}"`;
      if (stitch.lineCount) attrs += ` inkstitch:line_count="${stitch.lineCount}"`;
      if (stitch.joinStyle !== undefined) attrs += ` inkstitch:join_style="${stitch.joinStyle}"`;
      if (stitch.repeats && stitch.repeats > 1) attrs += ` inkstitch:repeats="${stitch.repeats}"`;
      if (stitch.beanStitchRepeats) attrs += ` inkstitch:bean_stitch_repeats="${stitch.beanStitchRepeats}"`;
      return { presentation, inkstitch: attrs };
    }
    case "satinColumn": {
      const spacing = toViewBoxUnits(densityToRange(stitch.density, ZIGZAG_SPACING_RANGE_MM));
      let attrs = `inkstitch:satin_column="true" inkstitch:satin_method="satin_column" ` +
        `inkstitch:zigzag_spacing_mm="${spacing}" ` +
        `inkstitch:center_walk_underlay="${stitch.underlay ? "true" : "false"}"`;
      if (stitch.pullCompensationMm && stitch.pullCompensationMm > 0) {
        attrs += ` inkstitch:pull_compensation_mm="${stitch.pullCompensationMm}"`;
      }
      return { presentation, inkstitch: attrs };
    }
  }
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
