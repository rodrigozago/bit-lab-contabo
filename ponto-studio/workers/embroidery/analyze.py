"""
Bordado Digital — Análise de imagem por processamento digital (sem IA)
====================================================================
Pipeline: quantização k-means → limpeza morfológica → vetorização (VTracer)
→ SVG com um <g> por cor (todas as regiões da mesma cor, mesmo desconectadas,
ficam na mesma camada de bordado).

Determinístico: seed fixa no k-means — a mesma imagem com os mesmos parâmetros
produz sempre o mesmo SVG.
"""

import math
import os
import re
import tempfile
import xml.etree.ElementTree as ET
from dataclasses import dataclass

import cv2
import numpy as np
import vtracer

MAX_DIMENSION = 800  # px — imagens maiores são reduzidas antes do pipeline
KMEANS_SEED = 42
# ΔE (distância euclidiana em Lab) abaixo do qual dois clusters são considerados
# a mesma cor e fundidos — garante "cores iguais = mesma camada". Default do
# parâmetro `color_tolerance`, ajustável pelo usuário (imagens com variação de
# tom, ex. fotografadas, podem precisar de um valor maior).
DEFAULT_MERGE_DELTA_E = 10.0


@dataclass
class AnalyzeParams:
    colors: int = 4          # nº de cores/linhas alvo (1–8) — cores DO DESENHO (fundo à parte)
    min_region_pct: float = 0.0   # regiões menores que isso (% da área) são absorvidas
    detail: int = 2          # 1 = mais liso, 3 = mais detalhe (corner threshold do vtracer)
    color_tolerance: float = DEFAULT_MERGE_DELTA_E  # ΔE em Lab — funde clusters de cor próxima
    max_areas: int = 8       # teto duro de camadas no SVG final (1–8) — funde as cores mais
                              # próximas até caber no limite, não importa de onde veio a fragmentação
    exclude_background: bool = True  # detecta o fundo (cluster que mais toca a borda) e o
                              # remove do SVG — sem isso, logo em fundo branco vira uma camada
                              # que bordaria o fundo INTEIRO, e o fundo "gasta" um dos clusters
                              # (IMP-5: logo 2 cores com colors=2 fundia as 2 cores do desenho)

    def clamped(self) -> "AnalyzeParams":
        return AnalyzeParams(
            colors=max(1, min(8, int(self.colors))),
            min_region_pct=max(0.0, min(5.0, float(self.min_region_pct))),
            detail=max(1, min(3, int(self.detail))),
            color_tolerance=max(0.0, min(40.0, float(self.color_tolerance))),
            max_areas=max(1, min(8, int(self.max_areas))),
            exclude_background=bool(self.exclude_background),
        )


# ── Etapas do pipeline ─────────────────────────────────────────────────────────

def load_and_downscale(image_path: str) -> np.ndarray:
    """Lê a imagem (BGR) e reduz para no máximo MAX_DIMENSION no maior lado."""
    img = cv2.imread(image_path, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError(f"Não foi possível ler a imagem: {image_path}")
    h, w = img.shape[:2]
    scale = MAX_DIMENSION / max(h, w)
    if scale < 1.0:
        img = cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
    return img


def is_flat_image(img_bgr: np.ndarray) -> bool:
    """
    True para imagens já chapadas (logos, line-art, cliparts): poucas cores
    dominantes. Nesses casos o filtro bilateral só borra traços finos.
    Conta buckets de cor de 5 bits por canal — fotos passam fácil de 256.
    """
    buckets = np.unique((img_bgr >> 3).reshape(-1, 3), axis=0)
    return len(buckets) <= 256


def quantize(
    img_bgr: np.ndarray, n_colors: int, merge_delta_e: float = DEFAULT_MERGE_DELTA_E
) -> tuple[np.ndarray, np.ndarray]:
    """
    K-means em espaço Lab (agrupamento perceptual) com seed fixa.
    Retorna (labels HxW, palette BGR n×3 uint8) já com clusters de cores
    a menos de `merge_delta_e` de distância fundidos entre si.
    """
    # bilateral só para fotos — em line-art ele borra os traços finos
    smoothed = img_bgr if is_flat_image(img_bgr) else cv2.bilateralFilter(img_bgr, d=9, sigmaColor=75, sigmaSpace=75)
    lab = cv2.cvtColor(smoothed, cv2.COLOR_BGR2Lab)
    samples = lab.reshape(-1, 3).astype(np.float32)

    cv2.setRNGSeed(KMEANS_SEED)
    criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 20, 1.0)
    _, labels, centers = cv2.kmeans(
        samples, n_colors, None, criteria, attempts=3, flags=cv2.KMEANS_PP_CENTERS
    )
    labels = labels.reshape(img_bgr.shape[:2])

    # Funde clusters com centróides a menos de merge_delta_e de distância
    labels, centers = _merge_similar_clusters(labels, centers, merge_delta_e)

    palette_lab = centers.reshape(-1, 1, 3).astype(np.uint8)
    palette_bgr = cv2.cvtColor(palette_lab, cv2.COLOR_Lab2BGR).reshape(-1, 3)
    return labels, palette_bgr


def _merge_similar_clusters(
    labels: np.ndarray, centers: np.ndarray, delta_e: float
) -> tuple[np.ndarray, np.ndarray]:
    """Une clusters cujos centros Lab distam menos que delta_e."""
    n = len(centers)
    mapping = list(range(n))
    for i in range(n):
        for j in range(i + 1, n):
            if mapping[j] != j:
                continue
            if np.linalg.norm(centers[i] - centers[j]) < delta_e:
                mapping[j] = mapping[i]

    # Reindexa para labels compactos (0..k-1)
    unique_targets = sorted(set(mapping))
    reindex = {old: new for new, old in enumerate(unique_targets)}
    final_map = np.array([reindex[mapping[i]] for i in range(n)])

    new_labels = final_map[labels]
    new_centers = np.stack([
        centers[[i for i in range(n) if reindex.get(mapping[i]) == k]].mean(axis=0)
        for k in range(len(unique_targets))
    ])
    return new_labels, new_centers


def clean_labels(labels: np.ndarray, n_colors: int, min_region_pct: float) -> np.ndarray:
    """
    Limpeza sem morfologia (open/close comia traços finos de logos):
      1. Dissolve clusters-halo: clusters formados só pelo anti-aliasing das
         bordas (estruturas < ~3px de espessura em toda a sua extensão).
      2. Remove componentes conexos menores que min_region_pct da área.
      3. Preenche os buracos com o label do pixel VIZINHO MAIS PRÓXIMO real
         (distance transform) — sem viés direcional, não engorda nem funde
         traços vizinhos.
    """
    h, w = labels.shape
    min_area = int(h * w * min_region_pct / 100.0)
    result = labels.astype(np.int32).copy()

    kernel3 = np.ones((3, 3), np.uint8)

    # 1. clusters-halo (anti-aliasing): somem com uma única erosão 3x3
    for color in range(n_colors):
        mask = (result == color).astype(np.uint8)
        if mask.sum() == 0:
            continue
        if cv2.erode(mask, kernel3).sum() == 0:
            result[mask.astype(bool)] = -1

    # 2. componentes pequenos demais para bordar
    for color in range(n_colors):
        mask = (result == color).astype(np.uint8)
        if mask.sum() == 0:
            continue
        n_comp, comp_labels, stats, _ = cv2.connectedComponentsWithStats(mask, connectivity=8)
        for comp in range(1, n_comp):
            if stats[comp, cv2.CC_STAT_AREA] < min_area:
                result[comp_labels == comp] = -1

    # 3. preenchimento por vizinho mais próximo (determinístico, sem viés)
    holes = result == -1
    if holes.all():
        return np.zeros_like(result)
    if holes.any():
        # para cada pixel de buraco, o índice do pixel NÃO-buraco mais próximo
        _, nearest = cv2.distanceTransformWithLabels(
            holes.astype(np.uint8), cv2.DIST_L2, 3, labelType=cv2.DIST_LABEL_PIXEL
        )
        known = ~holes
        lut = np.zeros(int(nearest.max()) + 1, dtype=result.dtype)
        lut[nearest[known]] = result[known]
        result[holes] = lut[nearest[holes]]

    return result


def render_quantized(labels: np.ndarray, palette_bgr: np.ndarray) -> np.ndarray:
    """Reconstrói a imagem BGR chapada a partir dos labels + paleta."""
    return palette_bgr[labels]


def vectorize(quantized_bgr: np.ndarray, params: AnalyzeParams) -> str:
    """Roda o VTracer sobre a imagem quantizada e retorna o SVG (string)."""
    corner_by_detail = {1: 90, 2: 60, 3: 30}
    with tempfile.TemporaryDirectory() as tmp:
        in_path = os.path.join(tmp, "in.png")
        out_path = os.path.join(tmp, "out.svg")
        cv2.imwrite(in_path, quantized_bgr)
        vtracer.convert_image_to_svg_py(
            in_path,
            out_path,
            colormode="color",
            # cutout: cada cor exclui as regiões das outras → miolo de letra
            # (counter) vira buraco real no path daquela cor, preservado no
            # split por cor. stacked "tampava" o buraco com a forma de trás.
            hierarchical="cutout",
            mode="spline",
            filter_speckle=4,
            color_precision=8,
            corner_threshold=corner_by_detail[params.detail],
            length_threshold=4.0,
            splice_threshold=45,
            path_precision=2,
        )
        with open(out_path, "r", encoding="utf-8") as f:
            return f.read()


SVG_NS = "http://www.w3.org/2000/svg"

# comandos de path e quantos pares (x, y) cada um carrega por repetição
_ABS_XY_COMMANDS = {"M": 1, "L": 1, "T": 1, "C": 3, "S": 2, "Q": 2}


def bake_translate(d: str, tx: float, ty: float) -> str:
    """
    Aplica translate(tx, ty) diretamente nas coordenadas do atributo "d".
    Necessário porque o vtracer emite paths com transform="translate(...)",
    que renderiza no browser mas é IGNORADO pelo svgpathtools do worker de
    exportação (e o reescalonamento da API também só mexe no d).

    Cobre o formato do vtracer (M/L/C absolutos + Z); comandos relativos não
    são afetados por translação e passam intactos.
    """
    tokens = re.findall(r"[MLHVCSQTAZmlhvcsqtaz]|-?\d*\.?\d+(?:[eE][+-]?\d+)?", d)
    out: list[str] = []
    cmd = ""
    i = 0
    while i < len(tokens):
        tok = tokens[i]
        if re.match(r"^[MLHVCSQTAZmlhvcsqtaz]$", tok):
            cmd = tok
            out.append(tok)
            i += 1
            continue

        upper = cmd.upper()
        is_abs = cmd.isupper()
        if upper in _ABS_XY_COMMANDS:
            pairs = _ABS_XY_COMMANDS[upper]
            for _ in range(pairs):
                if i + 1 >= len(tokens):
                    break
                x, y = float(tokens[i]), float(tokens[i + 1])
                if is_abs:
                    x, y = x + tx, y + ty
                out.append(f"{x:g} {y:g}")
                i += 2
        elif upper == "H":
            v = float(tokens[i])
            out.append(f"{v + tx:g}" if is_abs else f"{v:g}")
            i += 1
        elif upper == "V":
            v = float(tokens[i])
            out.append(f"{v + ty:g}" if is_abs else f"{v:g}")
            i += 1
        else:
            out.append(tokens[i])
            i += 1

    return " ".join(out)


def group_paths_by_color(svg: str) -> str:
    """
    Reorganiza o SVG do VTracer agrupando todos os <path> de mesmo fill num
    único <g fill="#hex"> — uma camada de bordado por cor, mesmo que as
    regiões estejam desconectadas. Ordem dos grupos: por área pintada
    (aproximada pela ordem original do vtracer, que empilha de trás pra frente).
    """
    ET.register_namespace("", SVG_NS)
    root = ET.fromstring(svg)

    groups: dict[str, list[ET.Element]] = {}
    order: list[str] = []

    for path in root.iter(f"{{{SVG_NS}}}path"):
        fill = _normalize_fill(path.get("fill") or path.get("style") or "#000000")
        path.set("fill", fill)
        path.attrib.pop("style", None)

        # Aplica translate(...) do vtracer direto no "d" e remove o transform
        transform = path.get("transform")
        if transform:
            m = re.match(r"\s*translate\(\s*(-?[\d.]+)\s*[, ]\s*(-?[\d.]+)\s*\)\s*$", transform)
            if m:
                path.set("d", bake_translate(path.get("d") or "", float(m.group(1)), float(m.group(2))))
                path.attrib.pop("transform", None)

        if fill not in groups:
            groups[fill] = []
            order.append(fill)
        groups[fill].append(path)

    # Limpa os filhos e recria como grupos por cor
    for child in list(root):
        root.remove(child)

    for fill in order:
        g = ET.SubElement(root, f"{{{SVG_NS}}}g")
        g.set("fill", fill)
        g.set("data-layer-color", fill)
        for path in groups[fill]:
            g.append(path)

    return ET.tostring(root, encoding="unicode")


def _normalize_fill(value: str) -> str:
    """Extrai/normaliza cor para #rrggbb minúsculo (aceita style='fill:#...')."""
    m = re.search(r"#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})", value)
    if not m:
        return "#000000"
    hex_part = m.group(1).lower()
    if len(hex_part) == 3:
        hex_part = "".join(c * 2 for c in hex_part)
    return f"#{hex_part}"


def _bgr_to_hex(bgr: np.ndarray) -> str:
    """(B, G, R) uint8 → "#rrggbb" minúsculo."""
    b, g, r = (int(c) for c in bgr)
    return f"#{r:02x}{g:02x}{b:02x}"


def _detect_background_index(labels: np.ndarray, n_colors: int) -> int:
    """
    Heurística simples e determinística: o "fundo" é o cluster com mais
    pixels tocando a borda da imagem (comum em logos/recortes sobre fundo
    sólido). Em caso de empate, o de maior área total.
    """
    border = np.concatenate([labels[0, :], labels[-1, :], labels[:, 0], labels[:, -1]])
    border_counts = np.bincount(border, minlength=n_colors)
    total_counts = np.bincount(labels.ravel(), minlength=n_colors)
    # ordena por (pixels na borda, área total) — desempate por área
    return int(max(range(n_colors), key=lambda i: (border_counts[i], total_counts[i])))


def _hex_to_lab(hex_color: str) -> np.ndarray:
    """"#rrggbb" → vetor Lab (float64), para medir distância perceptual entre cores finais."""
    r, g, b = int(hex_color[1:3], 16), int(hex_color[3:5], 16), int(hex_color[5:7], 16)
    bgr = np.array([[[b, g, r]]], dtype=np.uint8)
    lab = cv2.cvtColor(bgr, cv2.COLOR_BGR2Lab)
    return lab[0, 0].astype(np.float64)


# ΔE abaixo do qual duas cores do SVG final são consideradas a mesma "na prática"
# — cobre só arredondamento (vtracer/PNG), não a tolerância que o usuário escolhe.
_ROUNDING_DELTA_E = 6.0


def _remove_color_group(svg: str, hex_color: str, tolerance: float = _ROUNDING_DELTA_E) -> str:
    """
    Remove do SVG os grupos perceptualmente iguais a `hex_color` (ΔE < tolerance),
    não só o match exato — o vtracer pode gerar uma cor de fundo com um hex
    ligeiramente diferente do calculado (arredondamento), e nesse caso o match
    exato deixaria um "fundo fantasma" no resultado.
    """
    ET.register_namespace("", SVG_NS)
    root = ET.fromstring(svg)
    target = _hex_to_lab(hex_color)
    for g in list(root.iter(f"{{{SVG_NS}}}g")):
        color = g.get("data-layer-color")
        if color and float(np.linalg.norm(_hex_to_lab(color) - target)) < tolerance:
            root.remove(g)
    return ET.tostring(root, encoding="unicode")


def _extract_color_groups(root: ET.Element) -> list[dict]:
    """Lê os <g data-layer-color="..."> do root em [{"color", "paths"}, ...]."""
    entries: list[dict] = []
    for g in list(root.iter(f"{{{SVG_NS}}}g")):
        color = g.get("data-layer-color")
        if color:
            entries.append({"color": color, "paths": list(g)})
    return entries


def _rebuild_grouped_svg(root: ET.Element, entries: list[dict]) -> str:
    for child in list(root):
        root.remove(child)
    for entry in entries:
        g = ET.SubElement(root, f"{{{SVG_NS}}}g")
        g.set("fill", entry["color"])
        g.set("data-layer-color", entry["color"])
        for path in entry["paths"]:
            g.append(path)
    return ET.tostring(root, encoding="unicode")


def _closest_pair(labs: list[np.ndarray]) -> tuple[int, int, float]:
    """Índices (i, j) do par de cores mais próximo em Lab, e a distância entre eles."""
    best_pair = (0, 1)
    best_dist = float(np.linalg.norm(labs[0] - labs[1]))
    for i in range(len(labs)):
        for j in range(i + 1, len(labs)):
            d = float(np.linalg.norm(labs[i] - labs[j]))
            if d < best_dist:
                best_dist = d
                best_pair = (i, j)
    return best_pair[0], best_pair[1], best_dist


def _merge_entry_pair(entries: list[dict], labs: list[np.ndarray], i: int, j: int) -> None:
    """
    Funde entries[j] em entries[i], mantendo a cor do grupo com mais paths.
    Reescreve o `fill` de cada <path> absorvido pra cor do grupo alvo — cada
    <path> carrega seu próprio `fill` (setado em group_paths_by_color), então
    só trocar o `fill`/`data-layer-color` do <g> não é suficiente: quem lê a
    cor do <path> direto (splitSvgByColor no front, svg2paths2 no worker de
    export) ainda veria a cor antiga e a fusão não teria efeito nenhum.
    """
    if len(entries[j]["paths"]) > len(entries[i]["paths"]):
        i, j = j, i
    target_color = entries[i]["color"]
    for path in entries[j]["paths"]:
        path.set("fill", target_color)
    entries[i]["paths"].extend(entries[j]["paths"])
    del entries[j]
    del labs[j]


def merge_similar_svg_colors(svg: str, tolerance: float) -> str:
    """
    Funde grupos de cor cuja distância Lab é menor que `tolerance` — cobre
    fragmentação que sobra do vtracer no SVG final (cores quase idênticas que
    deveriam ser uma só camada de bordado), não apenas a fusão de clusters
    feita no k-means.
    """
    if tolerance <= 0:
        return svg

    ET.register_namespace("", SVG_NS)
    root = ET.fromstring(svg)
    entries = _extract_color_groups(root)
    if len(entries) <= 1:
        return svg

    labs = [_hex_to_lab(e["color"]) for e in entries]

    while len(entries) > 1:
        i, j, dist = _closest_pair(labs)
        if dist >= tolerance:
            break
        _merge_entry_pair(entries, labs, i, j)

    return _rebuild_grouped_svg(root, entries)


def cap_max_areas(svg: str, max_areas: int) -> str:
    """
    Teto duro de camadas no SVG final: se sobrarem mais grupos de cor que
    `max_areas` (fragmentação pode vir do vtracer, não só do k-means), funde
    iterativamente o par de cores mais próximo em Lab até caber no limite.
    O grupo resultante herda a cor do maior dos dois (mais área pintada).
    """
    if max_areas < 1:
        return svg

    ET.register_namespace("", SVG_NS)
    root = ET.fromstring(svg)
    entries = _extract_color_groups(root)
    if len(entries) <= max_areas:
        return svg

    labs = [_hex_to_lab(e["color"]) for e in entries]

    while len(entries) > max_areas:
        i, j, _dist = _closest_pair(labs)
        _merge_entry_pair(entries, labs, i, j)

    return _rebuild_grouped_svg(root, entries)


# ── Métricas por camada (heurística de parâmetros de ponto) ───────────────────

def _layer_metrics(mask: np.ndarray) -> dict:
    """
    Métricas geométricas de uma camada de cor (máscara booleana HxW), usadas
    pela heurística de sugestão de parâmetros de ponto no front:
      - areaPct: % da imagem coberta pela camada;
      - meanWidthPx: largura TÍPICA do traço, via 2×área/perímetro — pra uma
        tira fina (área ≈ largura×comprimento, perímetro ≈ 2×comprimento
        quando comprimento >> largura), isso converge pra largura real. A
        alternativa óbvia (2× a MÉDIA do distance transform) SUBESTIMA a
        largura de tiras longas, porque as pontas da tira têm distância à
        borda bem menor que o meio e puxam a média pra baixo;
      - maxWidthPx: 2× o MÁXIMO do distance transform (esse não sofre do
        mesmo problema — o pico fica no meio, longe das pontas);
      - regionCount: nº de regiões desconectadas;
      - principalAngleDeg (0–180, eixo y pra baixo como no SVG) e elongation
        (razão dos eixos principais, ≥1): orientação e alongamento via momentos
        centrais — colunas finas/alongadas são candidatas a cetim perpendicular.
    """
    m8 = mask.astype(np.uint8)
    area_px = int(m8.sum())
    area_pct = 100.0 * area_px / mask.size if mask.size else 0.0

    if area_px == 0:
        return {
            "areaPct": 0.0, "meanWidthPx": 0.0, "maxWidthPx": 0.0,
            "regionCount": 0, "principalAngleDeg": 0.0, "elongation": 1.0,
        }

    n_comp, _lbl, _stats, _cent = cv2.connectedComponentsWithStats(m8, connectivity=8)
    dist = cv2.distanceTransform(m8, cv2.DIST_L2, 3)

    contours, _ = cv2.findContours(m8, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    perimeter = sum(cv2.arcLength(c, True) for c in contours)
    mean_width = 2.0 * area_px / perimeter if perimeter > 0 else 0.0

    mom = cv2.moments(m8, binaryImage=True)
    if mom["m00"] > 0:
        mu20 = mom["mu20"] / mom["m00"]
        mu02 = mom["mu02"] / mom["m00"]
        mu11 = mom["mu11"] / mom["m00"]
        angle_deg = math.degrees(0.5 * math.atan2(2 * mu11, mu20 - mu02)) % 180.0
        spread = math.sqrt(max((mu20 - mu02) ** 2 + 4 * mu11 ** 2, 0.0))
        lam1 = (mu20 + mu02 + spread) / 2
        lam2 = (mu20 + mu02 - spread) / 2
        elongation = math.sqrt(lam1 / lam2) if lam2 > 1e-9 else 10.0
    else:
        angle_deg, elongation = 0.0, 1.0

    return {
        "areaPct": round(area_pct, 3),
        "meanWidthPx": round(mean_width, 2),
        "maxWidthPx": round(float(2.0 * dist[mask].max()), 2),
        "regionCount": int(n_comp - 1),
        "principalAngleDeg": round(angle_deg, 1),
        "elongation": round(min(elongation, 99.0), 2),
    }


def _compute_layer_metrics(
    svg: str, labels: np.ndarray, palette: np.ndarray, bg_index: int | None
) -> dict:
    """
    Reconstrói a máscara de cada camada FINAL do SVG (pós-fusões de cor):
    cada cluster da paleta (menos o fundo) é atribuído à cor final mais
    próxima em Lab — o mesmo critério usado nas fusões — e as máscaras dos
    clusters do mesmo destino são unidas.
    """
    h, w = labels.shape
    ET.register_namespace("", SVG_NS)
    try:
        root = ET.fromstring(svg)
        entries = _extract_color_groups(root)
    except ET.ParseError:
        entries = []

    layers: list[dict] = []
    if entries:
        final_labs = [_hex_to_lab(e["color"]) for e in entries]
        cluster_to_layer: dict[int, int] = {}
        for ci in range(len(palette)):
            if bg_index is not None and ci == bg_index:
                continue
            c_lab = _hex_to_lab(_bgr_to_hex(palette[ci]))
            dists = [float(np.linalg.norm(c_lab - fl)) for fl in final_labs]
            cluster_to_layer[ci] = int(np.argmin(dists))

        for li, entry in enumerate(entries):
            mask = np.zeros((h, w), dtype=bool)
            for ci, target in cluster_to_layer.items():
                if target == li:
                    mask |= labels == ci
            layers.append({"color": entry["color"], **_layer_metrics(mask)})

    return {"imageWidth": w, "imageHeight": h, "layers": layers}


# ── Entrada principal ──────────────────────────────────────────────────────────

def analyze_image_with_metrics(
    image_path: str, params: AnalyzeParams | None = None
) -> tuple[str, dict]:
    """
    Pipeline completo: imagem → (SVG agrupado por cor, métricas por camada).

    Com `exclude_background` (default), `colors` significa cores DO DESENHO:
    internamente segmenta em `colors + 1` clusters (desenho + fundo), detecta
    qual é o fundo (cluster que mais toca a borda da imagem) e remove essa
    camada do SVG final. Sem isso, um logo em fundo branco virava uma camada
    que bordaria o fundo inteiro — e o fundo "gastava" um dos clusters
    pedidos, fundindo cores do desenho (IMP-5).

    `colors == 1` continua sendo "só o primeiro plano" (2 clusters, fundo
    removido) mesmo com exclude_background=False — k=1 no k-means não faz
    sentido (colapsaria a imagem inteira numa única cor média).
    """
    p = (params or AnalyzeParams()).clamped()
    exclude_background = p.exclude_background or p.colors == 1
    n_colors = p.colors + 1 if exclude_background else p.colors
    # Quando o fundo vai ser removido, a tolerância de cor do usuário NÃO pode
    # se aplicar ao split fundo/desenho: se fundo e desenho forem tons
    # próximos (ex. bege sobre branco), a fusão colapsaria os clusters ANTES
    # de sabermos qual é o fundo — o fundo nunca seria removido. A tolerância
    # entre cores do desenho é aplicada depois, no SVG final
    # (merge_similar_svg_colors), onde o fundo já saiu.
    cluster_tolerance = 0.0 if exclude_background else p.color_tolerance

    img = load_and_downscale(image_path)
    labels, palette = quantize(img, n_colors, cluster_tolerance)
    labels = clean_labels(labels, len(palette), p.min_region_pct)
    quantized = render_quantized(labels, palette)
    svg = vectorize(quantized, p)
    grouped = group_paths_by_color(svg)

    bg_index: int | None = None
    if exclude_background and len(palette) > 1:
        bg_index = _detect_background_index(labels, len(palette))
        grouped = _remove_color_group(grouped, _bgr_to_hex(palette[bg_index]))

    grouped = merge_similar_svg_colors(grouped, p.color_tolerance)
    grouped = cap_max_areas(grouped, p.max_areas)

    metrics = _compute_layer_metrics(grouped, labels, palette, bg_index)
    return grouped, metrics


def analyze_image(image_path: str, params: AnalyzeParams | None = None) -> str:
    """Compat: só o SVG (ver analyze_image_with_metrics)."""
    svg, _metrics = analyze_image_with_metrics(image_path, params)
    return svg
