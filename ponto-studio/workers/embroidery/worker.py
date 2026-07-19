"""
Ponto Studio — Embroidery Worker
=================================
Lê jobs da fila Redis (LIST "embroidery:jobs"), converte SVG → arquivo de bordado
usando pyembroidery + svgpathtools, e publica o resultado no canal
"embroidery:results".

Fluxo:
    1. BLPOP embroidery:jobs  →  { jobId, svgFile, format, projectId }
    2. Lê /exports/<svgFile>
    3. Converte SVG paths → pontos de bordado (pyembroidery)
    4. Grava /exports/<jobId>.<ext>
    5. PUBLISH embroidery:results  →  { jobId, status, outputFile | error }
"""

import json
import logging
import os
import sys
import time
from pathlib import Path
from typing import Any

import math

import pyembroidery
import redis
import svgpathtools
from svgpathtools import svg2paths2
from shapely.geometry import LineString, Polygon
from shapely.geometry.base import BaseGeometry

# ── Configuração ──────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [worker] %(levelname)s %(message)s",
    stream=sys.stdout,
)
log = logging.getLogger("embroidery-worker")

REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379")
JOBS_QUEUE = "embroidery:jobs"
RESULTS_CHANNEL = "embroidery:results"
EXPORTS_DIR = Path(os.environ.get("EXPORTS_DIR", "/exports"))
UPLOADS_DIR = Path(os.environ.get("UPLOADS_DIR", "/uploads"))

# Mapeamento de formato → extensão pyembroidery
FORMAT_MAP: dict[str, str] = {
    "DST": "dst",
    "PES": "pes",
    "JEF": "jef",
}

# Parâmetros de ponto (mm; SCALE_SVG_TO_EMB converte pra décimos de mm do
# pyembroidery). Defaults calibrados pelos do Ink/Stitch (lib/elements/*.py):
# row spacing 0.25mm, max stitch length 4mm, staggers 4, underlay 3× o topo,
# satin zigzag 0.4mm, center-walk 3mm, travel 2.5mm.
STITCH_SPACING_MM = 0.4        # distância entre linhas de preenchimento
RUNNING_STITCH_LEN_MM = 2.5    # comprimento de ponto corrido
SCALE_SVG_TO_EMB = 10          # 1 mm SVG → 10 unidades pyembroidery
LOCK_OFFSET_MM = 0.3           # amplitude dos micro-pontos de trava (tie-in/tie-off)
TATAMI_STITCH_LEN_MM = 3.0     # comprimento máx. do ponto AO LONGO da linha (≠ espaçamento entre linhas)
FILL_STAGGERS = 4              # ciclo de deslocamento das penetrações entre linhas (anti-"veludo canelado")
UNDERLAY_SPACING_FACTOR = 3.0  # underlay tatami: espaçamento = 3× o do preenchimento do topo
CENTER_WALK_SPACING_MM = 1.5   # passo do center-walk (underlay do satin) ao longo da coluna
SATIN_MAX_WIDTH_MM = 10.0      # coluna mais larga que isso não é satin — cai pra tatami
TRAVEL_STITCH_LEN_MM = 2.5     # travel entre linhas: subdividido em pontos deste tamanho
JUMP_GAP_MM = 6.0              # travel maior que isso vira JUMP (não costura ponte longa)
POLYGON_SAMPLING_MM = 0.2      # resolução da amostragem path → polígono shapely


# ── Conversão SVG → bordado ───────────────────────────────────────────────────

def hex_to_rgb(hex_color: str) -> tuple[int, int, int]:
    """#RRGGBB → (R, G, B)"""
    h = hex_color.lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
    return r, g, b


def path_to_polyline(
    path: svgpathtools.Path, samples: int = 64
) -> list[tuple[float, float]]:
    """Amostra um SVG path em pontos (x, y)."""
    length = path.length()
    if length == 0:
        return []
    points: list[tuple[float, float]] = []
    for i in range(samples + 1):
        t = i / samples
        pt = path.point(t)
        points.append((pt.real, pt.imag))
    return points


def path_to_running_stitches(
    path: svgpathtools.Path, stitch_len_mm: float = RUNNING_STITCH_LEN_MM
) -> list[tuple[float, float, bool]]:
    """
    Ponto corrido de verdade (STI-2): amostra cada SUBPATH contínuo por
    comprimento de arco, um ponto a cada `stitch_len_mm` — o comprimento do
    ponto é constante e configurável (antes eram 128 amostras fixas: ponto
    gigante em forma grande, minúsculo em forma pequena, e o
    running_stitch_length da API era ignorado).

    Subpaths desconectados (buracos de letra, formas separadas no mesmo "d")
    começam com jump_before=True — sem isso a agulha costura uma ponte reta
    entre eles.
    """
    stitch_len = max(stitch_len_mm, 0.1)
    stitches: list[tuple[float, float, bool]] = []

    try:
        subpaths = path.continuous_subpaths()
    except Exception:
        subpaths = [path]

    for sub in subpaths:
        length = sub.length()
        if length == 0:
            continue
        n = max(int(length / stitch_len), 1)
        for i in range(n + 1):
            # ilength converte comprimento de arco → parâmetro t (amostragem
            # uniforme no espaço, não no parâmetro — curvas não distorcem)
            try:
                t = sub.ilength(min(i * stitch_len, length))
            except Exception:
                t = i / n
            pt = sub.point(t)
            stitches.append((pt.real, pt.imag, i == 0))

    return stitches


def _sample_ring(sub: svgpathtools.Path, sampling_mm: float) -> list[tuple[float, float]]:
    """Amostra um subpath contínuo num anel de pontos (fechado)."""
    pts: list[tuple[float, float]] = []
    for seg in sub:
        seg_len = seg.length()
        if seg_len == 0:
            continue
        n = max(int(seg_len / sampling_mm), 1)
        for i in range(n):
            pt = seg.point(i / n)
            pts.append((pt.real, pt.imag))
    if pts and pts[0] != pts[-1]:
        pts.append(pts[0])
    return pts


def path_to_polygon(
    path: svgpathtools.Path, sampling_mm: float = POLYGON_SAMPLING_MM
) -> BaseGeometry | None:
    """
    Converte um Path do svgpathtools em geometria shapely com regra EVEN-ODD:
    cada subpath fechado vira um Polygon e a composição por symmetric_difference
    acumulado reproduz exatamente a regra par-ímpar do SVG (subpath dentro de
    outro = buraco; dentro de buraco = ilha; etc). É o mesmo modelo do Ink/Stitch
    (que interseta linhas de grating com um polígono shapely) — e elimina por
    construção o bug do pareamento par-ímpar de PONTOS de cruzamento, que
    quebrava quando a varredura passava exatamente sobre um vértice.
    """
    try:
        subpaths = path.continuous_subpaths()
    except Exception:
        subpaths = [path]

    polys: list[Polygon] = []
    for sub in subpaths:
        ring = _sample_ring(sub, sampling_mm)
        if len(ring) < 4:
            continue
        try:
            p = Polygon(ring)
            if not p.is_valid:
                p = p.buffer(0)  # conserta auto-interseções (comum em paths do vtracer)
            if not p.is_empty and p.area > 0:
                polys.append(p)
        except Exception:
            continue

    if not polys:
        return None
    geom: BaseGeometry = polys[0]
    for p in polys[1:]:
        try:
            geom = geom.symmetric_difference(p)
        except Exception:
            continue
    return None if geom.is_empty else geom


def _segments_from_intersection(inter: BaseGeometry) -> list[LineString]:
    """Extrai os trechos de linha de uma interseção shapely (como o Ink/Stitch)."""
    if inter.is_empty:
        return []
    t = inter.geom_type
    if t == "LineString":
        return [inter]
    if t in ("MultiLineString", "GeometryCollection"):
        return [g for g in inter.geoms if g.geom_type == "LineString"]
    return []  # Point/MultiPoint (tangências) — sem trecho costurável


def _grating_segments(
    geom: BaseGeometry, spacing: float, angle_deg: float
) -> tuple[list[tuple[int, float, float, list[tuple[float, float]]]], float, float]:
    """
    Varredura estilo Ink/Stitch: gera linhas paralelas ao ângulo, interseta cada
    uma com o polígono e devolve, por linha, os SEGMENTOS internos já projetados
    na coordenada `s` ao longo da direção da linha.

    Retorna (rows, dx, dy) onde rows = [(row_idx, bx, by, [(s_lo, s_hi), …])].
    `s` é comparável entre linhas (mesma origem projetada) — é o que permite o
    grid global de penetrações com stagger.
    """
    xmin, ymin, xmax, ymax = geom.bounds
    rad = math.radians(angle_deg)
    dx, dy = math.cos(rad), math.sin(rad)   # direção da linha de varredura
    px, py = -dy, dx                        # eixo perpendicular (avança entre linhas)

    center_x, center_y = (xmin + xmax) / 2, (ymin + ymax) / 2
    c_dir = center_x * dx + center_y * dy
    half_len = math.hypot(xmax - xmin, ymax - ymin)

    corners = [(xmin, ymin), (xmax, ymin), (xmax, ymax), (xmin, ymax)]
    perp_projs = [cx * px + cy * py for cx, cy in corners]
    t_min, t_max = min(perp_projs), max(perp_projs)

    rows: list[tuple[int, float, float, list[tuple[float, float]]]] = []
    n_rows = int((t_max - t_min) / spacing) + 1
    for row in range(n_rows + 1):
        t = t_min + row * spacing
        bx = t * px + c_dir * dx
        by = t * py + c_dir * dy
        scan = LineString([
            (bx - dx * half_len, by - dy * half_len),
            (bx + dx * half_len, by + dy * half_len),
        ])
        try:
            inter = scan.intersection(geom)
        except Exception:
            continue

        segs: list[tuple[float, float]] = []
        for ls in _segments_from_intersection(inter):
            ss = [(X - bx) * dx + (Y - by) * dy for X, Y in ls.coords]
            s_lo, s_hi = min(ss), max(ss)
            if s_hi - s_lo > 1e-6:
                segs.append((s_lo, s_hi))
        segs.sort()
        rows.append((row, bx, by, _merge_intervals(segs)))

    return rows, dx, dy


def _merge_intervals(
    segs: list[tuple[float, float]], eps: float = 1e-4
) -> list[tuple[float, float]]:
    """
    Funde intervalos adjacentes/sobrepostos da mesma linha. Necessário porque
    uma linha de varredura COLINEAR com uma aresta do polígono (ex.: a base de
    um retângulo) interseta cada mini-segmento do anel amostrado separadamente —
    viravam dezenas de "colunas" de 0.2mm com jump entre elas em vez de um
    segmento contínuo.
    """
    if len(segs) <= 1:
        return segs
    merged: list[tuple[float, float]] = [segs[0]]
    for lo, hi in segs[1:]:
        last_lo, last_hi = merged[-1]
        if lo <= last_hi + eps:
            merged[-1] = (last_lo, max(last_hi, hi))
        else:
            merged.append((lo, hi))
    return merged


def _polyline_fallback(path: svgpathtools.Path) -> list[tuple[float, float, bool]]:
    return [(x, y, i == 0) for i, (x, y) in enumerate(path_to_polyline(path))]


def satin_path_with_stitches(
    path: svgpathtools.Path,
    spacing_mm: float = STITCH_SPACING_MM,
    angle_deg: float = 45.0,
    pull_comp_mm: float = 0.0,
) -> list[tuple[float, float, bool]]:
    """
    Cetim: zigue-zague borda-a-borda atravessando a coluna — em cada linha de
    varredura a agulha vai de uma BORDA à outra, alternando a direção, formando
    a coluna de cetim clássica. `spacing_mm` é o passo do zigue-zague
    (Ink/Stitch: zigzag_spacing, default 0.4mm).

    Proteção de máquina: coluna com largura MEDIANA acima de SATIN_MAX_WIDTH_MM
    não é cetim viável (pontos longos demais soltam do tecido) — cai pra tatami,
    como o Ink/Stitch recomenda em colunas largas.
    """
    geom = path_to_polygon(path)
    if geom is None:
        return _polyline_fallback(path)

    spacing = max(spacing_mm, 1e-3)
    rows, dx, dy = _grating_segments(geom, spacing, angle_deg)

    widths = [hi - lo for _row, _bx, _by, segs in rows for lo, hi in segs]
    if widths:
        median_w = sorted(widths)[len(widths) // 2]
        if median_w > SATIN_MAX_WIDTH_MM:
            log.warning(
                "Coluna de cetim com largura mediana %.1fmm > %.0fmm — usando tatami",
                median_w, SATIN_MAX_WIDTH_MM,
            )
            return fill_path_with_stitches(
                path, spacing_mm=STITCH_SPACING_MM, angle_deg=angle_deg,
                pull_comp_mm=pull_comp_mm,
            )

    stitches: list[tuple[float, float, bool]] = []
    for row, bx, by, segs in rows:
        for seg_idx, (lo, hi) in enumerate(segs):
            # STI-3: pull compensation — estica o zigue-zague nas duas bordas
            lo -= pull_comp_mm
            hi += pull_comp_mm
            # zigue-zague: alterna a ordem borda→borda a cada linha
            ends = (lo, hi) if row % 2 == 0 else (hi, lo)
            for k, s in enumerate(ends):
                jump_before = seg_idx > 0 and k == 0
                stitches.append((bx + s * dx, by + s * dy, jump_before))

    return stitches or _polyline_fallback(path)


def satin_centerwalk_underlay(
    path: svgpathtools.Path,
    angle_deg: float = 45.0,
    spacing_mm: float = CENTER_WALK_SPACING_MM,
    repeats: int = 2,
) -> list[tuple[float, float, bool]]:
    """
    Underlay center-walk do cetim (default do Ink/Stitch): uma costura corrida
    pelo CENTRO da coluna (ida e volta, repeats=2), invisível sob o zigue-zague.
    Substitui o antigo crosshatch perpendicular, que era quase tão denso quanto
    o preenchimento principal e aparecia "atravessado" no bordado final — o
    efeito de "duas agulhas costurando dois lados ao mesmo tempo".
    """
    geom = path_to_polygon(path)
    if geom is None:
        return []

    rows, dx, dy = _grating_segments(geom, max(spacing_mm, 1e-3), angle_deg)
    mids: list[tuple[float, float]] = []
    for _row, bx, by, segs in rows:
        if not segs:
            continue
        # múltiplos segmentos na mesma linha (formas separadas): segue o maior
        lo, hi = max(segs, key=lambda p: p[1] - p[0])
        m = (lo + hi) / 2
        mids.append((bx + m * dx, by + m * dy))

    if len(mids) < 2:
        return []

    pts: list[tuple[float, float, bool]] = []
    for rep in range(max(repeats, 1)):
        seq = mids if rep % 2 == 0 else list(reversed(mids))
        start = 0 if rep == 0 else 1  # a volta começa de onde a ida parou
        for i in range(start, len(seq)):
            x, y = seq[i]
            pts.append((x, y, rep == 0 and i == 0))
    return pts


def fill_path_with_stitches(
    path: svgpathtools.Path,
    spacing_mm: float = STITCH_SPACING_MM,
    angle_deg: float = 45.0,
    pull_comp_mm: float = 0.0,
    stitch_len_mm: float = TATAMI_STITCH_LEN_MM,
    staggers: int = FILL_STAGGERS,
) -> list[tuple[float, float, bool]]:
    """
    Preenchimento tatami no modelo do Ink/Stitch (lib/stitches/fill.py):

    - Linhas de varredura viram SEGMENTOS via interseção shapely com o polígono
      even-odd (nunca pares de pontos de cruzamento) — buracos e tangências são
      respeitados por construção.
    - `spacing_mm` é a distância ENTRE linhas; `stitch_len_mm` é o comprimento
      máximo do ponto AO LONGO da linha (dois parâmetros distintos — tatami real
      tem linhas a ~0.4mm com pontos de ~3mm; usar um valor só gerava ou pontos
      minúsculos ou linhas esparsas com vãos).
    - Penetrações num grid GLOBAL ao longo da linha com STAGGER cíclico
      (`staggers` linhas antes de repetir) — sem isso as penetrações se alinham
      em colunas e o preenchimento ganha sulcos visíveis ("veludo canelado").
    - Linhas alternam a direção (vai-e-volta); travel entre linhas é subdividido
      em pontos de TRAVEL_STITCH_LEN_MM; vão maior que JUMP_GAP_MM vira JUMP.

    Retorna (x, y, jump_before).
    """
    geom = path_to_polygon(path)
    if geom is None:
        return _polyline_fallback(path)

    spacing = max(spacing_mm, 1e-3)
    stitch_len = max(stitch_len_mm, 0.5)
    rows, dx, dy = _grating_segments(geom, spacing, angle_deg)

    stitches: list[tuple[float, float, bool]] = []
    last_pt: tuple[float, float] | None = None

    for row, bx, by, segs in rows:
        if not segs:
            continue
        # stagger do Ink/Stitch: desloca o grid de penetrações a cada linha
        stagger_offset = ((row / staggers) % 1.0) * stitch_len
        reverse = row % 2 == 1
        ordered = list(reversed(segs)) if reverse else segs

        for seg_idx, (lo, hi) in enumerate(ordered):
            # STI-3: pull compensation — o fio traciona o tecido pra dentro na
            # direção da costura; esticar cada linha nas pontas compensa isso
            lo -= pull_comp_mm
            hi += pull_comp_mm

            # penetrações no grid global s = k·stitch_len + stagger_offset
            k0 = math.ceil((lo - stagger_offset) / stitch_len)
            interior: list[float] = []
            k = k0
            while True:
                s = k * stitch_len + stagger_offset
                if s >= hi - 1e-6:
                    break
                if s > lo + 1e-6:
                    interior.append(s)
                k += 1
            seq = [lo] + interior + [hi]
            if reverse:
                seq.reverse()

            first_of_seg = True
            for s in seq:
                x, y = bx + s * dx, by + s * dy
                jump_before = False
                if first_of_seg:
                    if seg_idx > 0:
                        jump_before = True  # vão/buraco na MESMA linha — pula
                    elif last_pt is not None:
                        gap = math.hypot(x - last_pt[0], y - last_pt[1])
                        if gap > JUMP_GAP_MM:
                            jump_before = True  # ponte longa (forma côncava) — pula
                        elif gap > TRAVEL_STITCH_LEN_MM:
                            # travel curto: subdivide em pontos de até 2.5mm
                            n = int(gap / TRAVEL_STITCH_LEN_MM)
                            for i in range(1, n + 1):
                                f = i / (n + 1)
                                stitches.append((
                                    last_pt[0] + (x - last_pt[0]) * f,
                                    last_pt[1] + (y - last_pt[1]) * f,
                                    False,
                                ))
                stitches.append((x, y, jump_before))
                last_pt = (x, y)
                first_of_seg = False

    return stitches or _polyline_fallback(path)


def _add_lock_stitches(pattern: pyembroidery.EmbPattern, x: float, y: float) -> None:
    """
    Trava (tie-in/tie-off, STI-3): 3 micro-pontos em volta de (x, y) — prende
    o fio no início/fim de cada bloco de cor pra não desfiar quando a linha é
    cortada. Coordenadas em unidades SVG (mm).
    """
    scale = SCALE_SVG_TO_EMB
    for dx in (LOCK_OFFSET_MM, -LOCK_OFFSET_MM, 0.0):
        pattern.add_stitch_absolute(pyembroidery.STITCH, (x + dx) * scale, y * scale)


def svg_to_embroidery(svg_path: Path, format_ext: str) -> pyembroidery.EmbPattern:
    """
    Lê um SVG e gera um EmbPattern com pontos de bordado.
    Cada <path> vira um bloco de pontos com a cor do atributo fill.
    Suporta atributos inkstitch:* para escolher estratégia de ponto.
    """
    pattern = pyembroidery.EmbPattern()

    try:
        paths, attributes, svg_attrs = svg2paths2(str(svg_path))
    except Exception as exc:
        log.error("Falha ao ler SVG %s: %s", svg_path, exc)
        return pattern

    # Uma cor pode vir espalhada em vários <path> desconectados (mesma camada
    # de bordado, ver group_paths_by_color) — só conta como troca de LINHA/cor
    # quando o fill muda de fato, senão cada região vira uma parada de troca
    # de linha na máquina para a MESMA cor (ex.: 17 "cores" pra 1 única linha).
    last_color: str | None = None
    # último ponto costurado — onde a trava de fim de bloco (tie-off) é feita
    last_stitch_pos: tuple[float, float] | None = None

    for path, attrs in zip(paths, attributes):
        if not path:
            continue

        fill_color = attrs.get("fill", "#000000")
        if fill_color in ("none", "transparent", ""):
            fill_color = attrs.get("stroke", "#000000")

        # Inkstitch attributes
        stitch_method = attrs.get("inkstitch:fill_method", "tatami_fill")
        stitch_type_raw = attrs.get("inkstitch:stroke_method", "")
        angle_raw = attrs.get("inkstitch:angle", "45")
        density_raw = attrs.get("inkstitch:line_distance", str(STITCH_SPACING_MM))
        run_len_raw = attrs.get("inkstitch:running_stitch_length", str(RUNNING_STITCH_LEN_MM))
        pull_comp_raw = attrs.get("inkstitch:pull_compensation_mm", "0")
        max_len_raw = attrs.get("inkstitch:max_stitch_length", str(TATAMI_STITCH_LEN_MM))
        wants_underlay = attrs.get("inkstitch:underlay", "") == "true"

        try:
            angle = float(angle_raw)
        except ValueError:
            angle = 45.0

        try:
            spacing = float(str(density_raw).replace("mm", ""))
        except ValueError:
            spacing = STITCH_SPACING_MM

        try:
            run_len = float(str(run_len_raw).replace("mm", ""))
        except ValueError:
            run_len = RUNNING_STITCH_LEN_MM

        try:
            pull_comp = max(0.0, min(0.5, float(str(pull_comp_raw).replace("mm", ""))))
        except ValueError:
            pull_comp = 0.0

        try:
            stitch_len = float(str(max_len_raw).replace("mm", ""))
        except ValueError:
            stitch_len = TATAMI_STITCH_LEN_MM

        # Rotação da parte (ponto:rotation, em graus) — o tldraw rotaciona o
        # shape no canvas e a API repassa aqui POR PATH, porque svg2paths2 lê só
        # o `d` (ignora transform/viewBox, inclusive em <g>). Path.rotated()
        # rotaciona curvas e arcos corretamente; aplicada ANTES da geração de
        # pontos, então o ângulo de varredura acompanha o desenho rotacionado.
        try:
            rot_deg = float(attrs.get("ponto:rotation", "0") or 0)
        except ValueError:
            rot_deg = 0.0
        if rot_deg:
            try:
                rot_cx = float(attrs.get("ponto:rotation_cx", "0") or 0)
                rot_cy = float(attrs.get("ponto:rotation_cy", "0") or 0)
                path = path.rotated(rot_deg, complex(rot_cx, rot_cy))
            except Exception as exc:
                log.warning("Falha ao aplicar rotação %s°: %s", rot_deg, exc)

        # Estratégia por tipo (STI-2): running = contorno com comprimento de
        # ponto configurável; contour_fill (cetim na UI) = zigue-zague
        # borda-a-borda; tatami_fill = preenchimento por varredura.
        is_running = stitch_type_raw == "running_stitch" or stitch_method == "running_stitch"
        is_satin = stitch_method == "contour_fill"

        try:
            if is_running:
                points = path_to_running_stitches(path, stitch_len_mm=run_len)
            elif is_satin:
                points = satin_path_with_stitches(path, spacing_mm=spacing, angle_deg=angle, pull_comp_mm=pull_comp)
            else:
                points = fill_path_with_stitches(
                    path, spacing_mm=spacing, angle_deg=angle,
                    pull_comp_mm=pull_comp, stitch_len_mm=stitch_len,
                )

            # STI-3: underlay estilo Ink/Stitch — passada de base ANTES do
            # preenchimento, que fica invisível debaixo dele. Mesma cor, sem
            # troca de linha; o primeiro ponto do preenchimento principal vira
            # JUMP pra não costurar ponte do fim do underlay até o início.
            #   - cetim: center-walk (costura corrida pelo centro da coluna);
            #   - tatami: perpendicular com 3× o espaçamento do topo (o antigo
            #     crosshatch quase tão denso quanto o topo aparecia no bordado
            #     final como um segundo desenho atravessado — "duas agulhas").
            if wants_underlay and not is_running:
                if is_satin:
                    underlay = satin_centerwalk_underlay(path, angle_deg=angle)
                else:
                    underlay = fill_path_with_stitches(
                        path,
                        spacing_mm=spacing * UNDERLAY_SPACING_FACTOR,
                        angle_deg=angle + 90.0,
                        stitch_len_mm=stitch_len,
                    )
                if underlay and points:
                    x0, y0, _ = points[0]
                    points = underlay + [(x0, y0, True)] + points[1:]
        except Exception as exc:
            log.warning("Erro ao gerar pontos para path: %s — usando polyline", exc)
            points = [(x, y, i == 0) for i, (x, y) in enumerate(path_to_polyline(path))]

        if not points:
            continue

        # Cor do fio — só troca de thread/linha quando a cor muda de verdade
        new_block = fill_color != last_color
        if new_block:
            if last_color is not None:
                # trava de FIM do bloco anterior (tie-off) antes do corte de linha
                if last_stitch_pos is not None:
                    _add_lock_stitches(pattern, *last_stitch_pos)
                pattern.add_stitch_absolute(pyembroidery.COLOR_BREAK, 0, 0)
            try:
                r, g, b = hex_to_rgb(fill_color)
                thread = pyembroidery.EmbThread()
                thread.color = (r << 16) | (g << 8) | b
                thread.name = fill_color
                pattern.add_thread(thread)
            except Exception:
                pattern.add_thread(pyembroidery.EmbThread())
            last_color = fill_color

        # Adiciona pontos ao padrão (unidade: décimos de mm) — pula (JUMP) no
        # 1º ponto do path e sempre que jump_before marcar um novo segmento
        # desconectado (buraco/vão), senão a agulha "costura" por cima do vão
        scale = SCALE_SVG_TO_EMB
        first = True
        for x, y, jump_before in points:
            cmd = pyembroidery.JUMP if (first or jump_before) else pyembroidery.STITCH
            pattern.add_stitch_absolute(cmd, x * scale, y * scale)
            if new_block and first:
                # trava de INÍCIO do bloco de cor (tie-in) no primeiro ponto
                _add_lock_stitches(pattern, x, y)
            first = False
            last_stitch_pos = (x, y)

    # trava do último bloco antes do END (a máquina corta a linha aqui)
    if last_stitch_pos is not None:
        _add_lock_stitches(pattern, *last_stitch_pos)
    pattern.add_stitch_absolute(pyembroidery.END, 0, 0)
    return pattern


# ── Preview: EmbPattern → SVG de linhas de ponto ──────────────────────────────

# comandos que interrompem uma linha contínua de pontos
_BREAK_COMMANDS = {
    pyembroidery.JUMP,
    pyembroidery.COLOR_BREAK,
    pyembroidery.STOP,
    pyembroidery.TRIM,
    pyembroidery.END,
}


def _thread_hex(pattern: pyembroidery.EmbPattern, index: int) -> str:
    """Cor #rrggbb do fio de índice `index` (fallback preto)."""
    threads = pattern.threadlist
    if 0 <= index < len(threads):
        return "#%06x" % (threads[index].color & 0xFFFFFF)
    return "#333333"


def pattern_to_preview_svg(pattern: pyembroidery.EmbPattern, viewbox: str) -> str:
    """
    Renderiza os pontos do EmbPattern como <polyline> (uma por trecho contínuo),
    coloridas pelo fio atual — mesma aparência de um visualizador DST. As coords
    do pattern estão em unidades_svg × SCALE_SVG_TO_EMB; dividimos de volta para
    o espaço do `viewbox` (o mesmo do elemento, para sobrepor no canvas).
    """
    polylines: list[str] = []
    run: list[str] = []
    color_index = 0

    def flush(color_idx: int) -> None:
        if len(run) >= 2:
            polylines.append(
                f'<polyline points="{" ".join(run)}" fill="none" '
                f'stroke="{_thread_hex(pattern, color_idx)}" stroke-width="0.8" '
                f'stroke-linejoin="round" stroke-linecap="round"/>'
            )
        run.clear()

    for stitch in pattern.stitches:
        x, y, cmd = stitch[0], stitch[1], stitch[2]
        if cmd == pyembroidery.STITCH:
            run.append(f"{x / SCALE_SVG_TO_EMB:g},{y / SCALE_SVG_TO_EMB:g}")
        elif cmd in _BREAK_COMMANDS:
            flush(color_index)
            if cmd == pyembroidery.COLOR_BREAK:
                color_index += 1
    flush(color_index)

    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{viewbox}">\n  '
        + "\n  ".join(polylines)
        + "\n</svg>"
    )


# comando pyembroidery → código compacto no JSON do player (EXP-2)
_STITCH_CMD_CODE: dict[int, int] = {
    pyembroidery.STITCH: 0,
    pyembroidery.JUMP: 1,
    pyembroidery.COLOR_BREAK: 2,
    pyembroidery.TRIM: 3,
    pyembroidery.END: 4,
}


def pattern_to_stitch_json(pattern: pyembroidery.EmbPattern, viewbox: str) -> dict[str, Any]:
    """
    Serializa o EmbPattern (mesmo gerado pelo DST) na sequência ordenada de
    pontos, para o player de simulação (EXP-2) animar no front — em vez de um
    SVG achatado (pattern_to_preview_svg), aqui cada ponto vira [x_mm, y_mm,
    cmdCode] (arrays, não objetos, pra manter o JSON compacto em designs com
    muitos milhares de pontos).
    """
    threads = [f"#{t.color & 0xFFFFFF:06x}" for t in pattern.threadlist] or ["#333333"]
    stitches = [
        [round(x / SCALE_SVG_TO_EMB, 2), round(y / SCALE_SVG_TO_EMB, 2), _STITCH_CMD_CODE.get(cmd, 0)]
        for x, y, cmd in pattern.stitches
    ]
    color_count = sum(1 for _x, _y, code in stitches if code == 2) + 1
    return {
        "viewBox": viewbox,
        "threads": threads,
        "stitches": stitches,
        "stats": {"totalStitches": len(stitches), "colorCount": color_count},
    }


def _svg_viewbox(svg_path: Path) -> str:
    """Extrai o atributo viewBox do SVG (fallback 0 0 100 100)."""
    import re

    text = svg_path.read_text(encoding="utf-8")
    m = re.search(r'viewBox="([^"]+)"', text)
    return m.group(1) if m else "0 0 100 100"


# ── Worker loop ───────────────────────────────────────────────────────────────

def process_job(r: redis.Redis, job_data: dict[str, Any]) -> None:
    job_id: str = job_data["jobId"]

    # Dispatch por tipo: "export" (default, SVG → bordado), "analyze"
    # (imagem → SVG, ver analyze.py), "preview" (SVG → linhas de ponto) ou
    # "stitch_data" (SVG → sequência de pontos em JSON, para o player EXP-2).
    job_type = job_data.get("type", "export")
    if job_type == "analyze":
        process_analyze_job(r, job_data)
        return
    if job_type == "preview":
        process_preview_job(r, job_data)
        return
    if job_type == "stitch_data":
        process_stitch_data_job(r, job_data)
        return

    svg_file: str = job_data["svgFile"]
    fmt: str = job_data.get("format", "DST").upper()

    log.info("Processando job %s  formato=%s", job_id, fmt)

    ext = FORMAT_MAP.get(fmt)
    if not ext:
        _publish_error(r, job_id, f"Formato desconhecido: {fmt}")
        return

    svg_path = EXPORTS_DIR / svg_file
    if not svg_path.exists():
        _publish_error(r, job_id, f"SVG não encontrado: {svg_file}")
        return

    output_file = f"{job_id}.{ext}"
    output_path = EXPORTS_DIR / output_file

    try:
        pattern = svg_to_embroidery(svg_path, ext)

        if len(pattern.stitches) == 0:
            _publish_error(r, job_id, "Nenhum ponto gerado — SVG pode não ter paths válidos")
            return

        pyembroidery.write(pattern, str(output_path))
        log.info("Job %s concluído → %s (%d pontos)", job_id, output_file, len(pattern.stitches))

        result = json.dumps({"jobId": job_id, "status": "done", "outputFile": output_file})
        r.publish(RESULTS_CHANNEL, result)

    except Exception as exc:
        log.exception("Job %s falhou", job_id)
        _publish_error(r, job_id, str(exc))


def process_analyze_job(r: redis.Redis, job_data: dict[str, Any]) -> None:
    """Análise local: imagem em UPLOADS_DIR → SVG por cor em EXPORTS_DIR."""
    from analyze import DEFAULT_MERGE_DELTA_E, AnalyzeParams, analyze_image_with_metrics

    job_id: str = job_data["jobId"]
    image_file: str = job_data["imageFile"]
    raw_params: dict[str, Any] = job_data.get("params", {})

    log.info("Processando análise %s  imagem=%s params=%s", job_id, image_file, raw_params)

    image_path = UPLOADS_DIR / image_file
    if not image_path.exists():
        _publish_error(r, job_id, f"Imagem não encontrada: {image_file}")
        return

    try:
        params = AnalyzeParams(
            colors=int(raw_params.get("colors", 4)),
            min_region_pct=float(raw_params.get("minRegionPct", 0)),
            detail=int(raw_params.get("detail", 2)),
            color_tolerance=float(raw_params.get("colorTolerance", DEFAULT_MERGE_DELTA_E)),
            max_areas=int(raw_params.get("maxAreas", AnalyzeParams().max_areas)),
            exclude_background=bool(raw_params.get("excludeBackground", True)),
        )
        svg, metrics = analyze_image_with_metrics(str(image_path), params)

        output_file = f"{job_id}.svg"
        (EXPORTS_DIR / output_file).write_text(svg, encoding="utf-8")
        # métricas por camada ao lado do SVG — a API anexa no status do job
        # (base da heurística de sugestão de parâmetros de ponto no front)
        (EXPORTS_DIR / f"{job_id}.metrics.json").write_text(
            json.dumps(metrics), encoding="utf-8"
        )
        log.info("Análise %s concluída → %s (%d bytes)", job_id, output_file, len(svg))

        result = json.dumps({"jobId": job_id, "status": "done", "outputFile": output_file})
        r.publish(RESULTS_CHANNEL, result)

    except Exception as exc:
        log.exception("Análise %s falhou", job_id)
        _publish_error(r, job_id, str(exc))


def process_preview_job(r: redis.Redis, job_data: dict[str, Any]) -> None:
    """
    Preview: SVG-entrada (um elemento anotado com inkstitch, no viewBox
    original) → mesmo motor de pontos do DST → SVG de linhas em EXPORTS_DIR.
    """
    job_id: str = job_data["jobId"]
    svg_file: str = job_data["svgFile"]  # {jobId}.in.svg gravado pela API

    log.info("Processando preview %s  svg=%s", job_id, svg_file)

    svg_path = EXPORTS_DIR / svg_file
    if not svg_path.exists():
        _publish_error(r, job_id, f"SVG de preview não encontrado: {svg_file}")
        return

    try:
        pattern = svg_to_embroidery(svg_path, "dst")  # mesmo código do export
        preview_svg = pattern_to_preview_svg(pattern, _svg_viewbox(svg_path))

        output_file = f"{job_id}.svg"
        (EXPORTS_DIR / output_file).write_text(preview_svg, encoding="utf-8")
        log.info("Preview %s concluído → %s (%d pontos)", job_id, output_file, len(pattern.stitches))

        r.publish(RESULTS_CHANNEL, json.dumps({"jobId": job_id, "status": "done", "outputFile": output_file}))
    except Exception as exc:
        log.exception("Preview %s falhou", job_id)
        _publish_error(r, job_id, str(exc))


def process_stitch_data_job(r: redis.Redis, job_data: dict[str, Any]) -> None:
    """
    Dados do player de simulação (EXP-2): SVG do projeto inteiro (mesmo
    arquivo que alimenta o export) → sequência de pontos em JSON, via o
    MESMO `svg_to_embroidery` do DST — o que se anima no player é fiel ao
    que a máquina borda de verdade.
    """
    job_id: str = job_data["jobId"]
    svg_file: str = job_data["svgFile"]

    log.info("Processando stitch_data %s  svg=%s", job_id, svg_file)

    svg_path = EXPORTS_DIR / svg_file
    if not svg_path.exists():
        _publish_error(r, job_id, f"SVG não encontrado: {svg_file}")
        return

    try:
        pattern = svg_to_embroidery(svg_path, "dst")  # formato ignorado, só monta o EmbPattern

        if len(pattern.stitches) == 0:
            _publish_error(r, job_id, "Nenhum ponto gerado — SVG pode não ter paths válidos")
            return

        data = pattern_to_stitch_json(pattern, _svg_viewbox(svg_path))

        output_file = f"{job_id}.json"
        (EXPORTS_DIR / output_file).write_text(json.dumps(data), encoding="utf-8")
        log.info("Stitch data %s concluído → %s (%d pontos)", job_id, output_file, len(pattern.stitches))

        r.publish(RESULTS_CHANNEL, json.dumps({"jobId": job_id, "status": "done", "outputFile": output_file}))
    except Exception as exc:
        log.exception("Stitch data %s falhou", job_id)
        _publish_error(r, job_id, str(exc))


def _publish_error(r: redis.Redis, job_id: str, message: str) -> None:
    log.error("Job %s erro: %s", job_id, message)
    r.publish(RESULTS_CHANNEL, json.dumps({"jobId": job_id, "status": "error", "error": message}))


def main() -> None:
    log.info("Worker iniciado. Conectando ao Redis: %s", REDIS_URL)
    EXPORTS_DIR.mkdir(parents=True, exist_ok=True)

    # socket_timeout deve ser maior que o timeout do BLPOP para não confundir
    # timeout de bloqueio com erro de socket
    BLPOP_TIMEOUT = 10
    r = redis.from_url(
        REDIS_URL,
        decode_responses=True,
        socket_timeout=BLPOP_TIMEOUT + 5,
        socket_connect_timeout=5,
    )

    # Aguarda Redis ficar disponível
    for attempt in range(10):
        try:
            r.ping()
            log.info("Redis conectado.")
            break
        except (redis.exceptions.ConnectionError, redis.exceptions.TimeoutError):
            log.warning("Redis indisponível, tentativa %d/10…", attempt + 1)
            time.sleep(2)
    else:
        log.error("Não foi possível conectar ao Redis após 10 tentativas. Encerrando.")
        sys.exit(1)

    log.info("Aguardando jobs na fila '%s'…", JOBS_QUEUE)

    while True:
        try:
            # BLPOP bloqueia até chegar um item (timeout=10s para checar saúde)
            item = r.blpop(JOBS_QUEUE, timeout=BLPOP_TIMEOUT)
            if item is None:
                continue  # timeout normal do BLPOP, volta a aguardar

            _, payload = item
            job_data = json.loads(payload)
            process_job(r, job_data)

        except redis.exceptions.ConnectionError as exc:
            log.error("Conexão Redis perdida: %s — reconectando em 3s…", exc)
            time.sleep(3)
        except redis.exceptions.TimeoutError:
            # Timeout do socket no BLPOP é normal quando a fila está vazia — ignora
            continue
        except json.JSONDecodeError as exc:
            log.error("Payload inválido: %s", exc)
        except KeyboardInterrupt:
            log.info("Worker encerrado.")
            break
        except Exception as exc:
            log.exception("Erro inesperado no loop principal: %s", exc)
            time.sleep(1)


if __name__ == "__main__":
    main()
