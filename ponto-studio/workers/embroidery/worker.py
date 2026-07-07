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

import pyembroidery
import redis
import svgpathtools
from svgpathtools import svg2paths2

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

# Parâmetros de ponto (em décimos de mm — unidade interna do pyembroidery)
STITCH_SPACING_MM = 0.4       # distância entre linhas de preenchimento
RUNNING_STITCH_LEN_MM = 2.5   # comprimento de ponto corrido
SCALE_SVG_TO_EMB = 10         # 1 mm SVG → 10 unidades pyembroidery


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


def fill_path_with_stitches(
    path: svgpathtools.Path,
    spacing_mm: float = STITCH_SPACING_MM,
    angle_deg: float = 45.0,
) -> list[tuple[float, float]]:
    """
    Gera pontos de preenchimento paralelos (tatami/satin simplificado).
    Usa bounding-box + varredura de linhas paralelas ao ângulo dado.
    """
    import math

    xmin, xmax, ymin, ymax = path.bbox()
    if xmax == xmin or ymax == ymin:
        return path_to_polyline(path)

    spacing = spacing_mm  # unidades SVG mm
    rad = math.radians(angle_deg)
    cos_a, sin_a = math.cos(rad), math.sin(rad)

    # Projeta corners no eixo perpendicular ao ângulo
    corners = [
        (xmin, ymin), (xmax, ymin), (xmax, ymax), (xmin, ymax)
    ]
    perp = [-sin_a, cos_a]
    projs = [c[0] * perp[0] + c[1] * perp[1] for c in corners]
    t_min, t_max = min(projs), max(projs)

    stitches: list[tuple[float, float]] = []
    t = t_min
    row = 0
    while t <= t_max:
        # Origem da linha de varredura
        ox = t * perp[0]
        oy = t * perp[1]
        # Direção da linha
        dx, dy = cos_a, sin_a

        # Intersecções da linha com o path
        intersections: list[float] = []
        try:
            for seg in path:
                # Parametrizar intersecção linha com segmento numericamente
                for s in range(20):
                    u = s / 19
                    pt = seg.point(u)
                    px, py = pt.real - ox, pt.imag - oy
                    proj = px * dx + py * dy
                    intersections.append(proj)
        except Exception:
            pass

        if not intersections:
            t += spacing
            row += 1
            continue

        s_min, s_max = min(intersections), max(intersections)

        # Alterna direção para zig-zag
        if row % 2 == 0:
            s_range = [s_min + k * spacing for k in range(int((s_max - s_min) / spacing) + 1)]
        else:
            s_range = [s_max - k * spacing for k in range(int((s_max - s_min) / spacing) + 1)]

        for s in s_range:
            px = ox + s * dx
            py = oy + s * dy
            if xmin - 1 <= px <= xmax + 1 and ymin - 1 <= py <= ymax + 1:
                stitches.append((px, py))

        t += spacing
        row += 1

    return stitches if stitches else path_to_polyline(path)


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

        try:
            angle = float(angle_raw)
        except ValueError:
            angle = 45.0

        try:
            spacing = float(str(density_raw).replace("mm", ""))
        except ValueError:
            spacing = STITCH_SPACING_MM

        # Determina estratégia
        is_running = stitch_type_raw == "running_stitch" or stitch_method == "running_stitch"

        try:
            if is_running:
                points = path_to_polyline(path, samples=128)
            else:
                points = fill_path_with_stitches(path, spacing_mm=spacing, angle_deg=angle)
        except Exception as exc:
            log.warning("Erro ao gerar pontos para path: %s — usando polyline", exc)
            points = path_to_polyline(path)

        if not points:
            continue

        # Cor do fio
        try:
            r, g, b = hex_to_rgb(fill_color)
            thread = pyembroidery.EmbThread()
            thread.color = (r << 16) | (g << 8) | b
            thread.name = fill_color
            pattern.add_thread(thread)
        except Exception:
            pattern.add_thread(pyembroidery.EmbThread())

        # Adiciona pontos ao padrão (unidade: décimos de mm)
        scale = SCALE_SVG_TO_EMB
        first = True
        for x, y in points:
            cmd = pyembroidery.STITCH if not first else pyembroidery.JUMP
            pattern.add_stitch_absolute(cmd, x * scale, y * scale)
            first = False

        pattern.add_stitch_absolute(pyembroidery.COLOR_BREAK, 0, 0)

    pattern.add_stitch_absolute(pyembroidery.END, 0, 0)
    return pattern


# ── Worker loop ───────────────────────────────────────────────────────────────

def process_job(r: redis.Redis, job_data: dict[str, Any]) -> None:
    job_id: str = job_data["jobId"]

    # Dispatch por tipo: "export" (default, SVG → bordado) ou "analyze"
    # (imagem → SVG por processamento digital, ver analyze.py)
    job_type = job_data.get("type", "export")
    if job_type == "analyze":
        process_analyze_job(r, job_data)
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
    from analyze import AnalyzeParams, analyze_image

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
            min_region_pct=float(raw_params.get("minRegionPct", 0.05)),
            detail=int(raw_params.get("detail", 2)),
        )
        svg = analyze_image(str(image_path), params)

        output_file = f"{job_id}.svg"
        (EXPORTS_DIR / output_file).write_text(svg, encoding="utf-8")
        log.info("Análise %s concluída → %s (%d bytes)", job_id, output_file, len(svg))

        result = json.dumps({"jobId": job_id, "status": "done", "outputFile": output_file})
        r.publish(RESULTS_CHANNEL, result)

    except Exception as exc:
        log.exception("Análise %s falhou", job_id)
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
