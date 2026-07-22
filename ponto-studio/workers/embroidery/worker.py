"""
Ponto Studio — Embroidery Worker
=================================
Lê jobs da fila Redis (LIST "embroidery:jobs") e converte SVG → arquivo de
bordado usando o BINÁRIO OFICIAL DO INK/STITCH (rodado via subprocess, ver
inkstitch_runner.py) — não mais um motor de pontos caseiro. Publica o
resultado no canal "embroidery:results".

Fluxo (export):
    1. BLPOP embroidery:jobs  →  { jobId, svgFile, format, projectId }
    2. Lê /exports/<svgFile>
    3. run_inkstitch(svg) → bytes do formato pedido (DST/PES/JEF/...)
    4. Grava /exports/<jobId>.<ext> (bytes ORIGINAIS do Ink/Stitch — não
       reserializados por pyembroidery, pra preservar fidelidade)
    5. PUBLISH embroidery:results  →  { jobId, status, outputFile | error }

pyembroidery ainda é usado para: (a) LER de volta o arquivo gerado (contar
pontos pra validar, e alimentar o simulador/preview do front) e (b)
funções auxiliares de serialização (pattern_to_stitch_json,
pattern_to_preview_svg) que já existiam e continuam fiéis ao mesmo arquivo
que a máquina borda de verdade — só que agora esse arquivo vem do Ink/Stitch.
"""

import json
import logging
import os
import sys
import tempfile
import time
from pathlib import Path
from typing import Any

import pyembroidery
import redis

from inkstitch_runner import run_inkstitch

# ── Configuração ──────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [worker] %(levelname)s %(message)s",
    stream=sys.stdout,
)
log = logging.getLogger("embroidery-worker")

# Rollbar (rastreio de erros): só liga com ROLLBAR_SERVER_TOKEN. Sem token (ou
# sem o pacote instalado) vira no-op, então rodar local não quebra. Ver
# docs/SEGURANCA-PRE-LANCAMENTO.md item 6.
_rollbar = None
_rollbar_token = os.environ.get("ROLLBAR_SERVER_TOKEN")
if _rollbar_token:
    try:
        import rollbar as _rollbar

        _rollbar.init(
            _rollbar_token,
            environment=os.environ.get("ROLLBAR_ENV", "production"),
            handler="blocking",
        )
    except Exception:  # noqa: BLE001 — sem Rollbar não pode derrubar o worker
        log.exception("Falha ao iniciar o Rollbar — seguindo sem rastreio de erros")
        _rollbar = None


def report_error() -> None:
    """Manda a exceção atual pro Rollbar, se configurado (no-op sem token)."""
    if _rollbar is not None:
        try:
            _rollbar.report_exc_info()
        except Exception:  # noqa: BLE001
            log.exception("Falha ao reportar erro pro Rollbar")


# Telemetria (timing/métricas) via Rollbar: eventos `info` contam na cota do
# free tier, então ficam atrás deste toggle. "0" desliga só a telemetria — os
# erros (report_error) continuam indo. No-op também sem ROLLBAR_SERVER_TOKEN.
_TELEMETRY_ON = os.environ.get("ROLLBAR_TELEMETRY", "1") != "0"


def report_message(event: str, level: str = "info", **data: Any) -> None:
    """
    Manda um evento de telemetria pro Rollbar (timing, métricas, profundidade de
    fila). No-op sem token, sem o pacote, ou com ROLLBAR_TELEMETRY=0. Nunca
    derruba o worker se o Rollbar falhar.
    """
    if _rollbar is None or not _TELEMETRY_ON:
        return
    try:
        _rollbar.report_message(event, level=level, extra_data=data)
    except Exception:  # noqa: BLE001 — telemetria não pode quebrar o job
        log.exception("Falha ao enviar telemetria pro Rollbar")


REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379")
JOBS_QUEUE = "embroidery:jobs"
RESULTS_CHANNEL = "embroidery:results"
EXPORTS_DIR = Path(os.environ.get("EXPORTS_DIR", "/exports"))
UPLOADS_DIR = Path(os.environ.get("UPLOADS_DIR", "/uploads"))

# Limite de backlog da fila: acima disso, o worker manda um alerta (warning) pro
# Rollbar. Threshold evita spam/cota quando a fila está saudável (perto de 0).
QUEUE_DEPTH_WARN = int(os.environ.get("QUEUE_DEPTH_WARN", "20"))


def _queue_depth(r: "redis.Redis") -> int:
    """Tamanho atual da fila de jobs (LLEN). 0 em caso de erro — não pode derrubar o job."""
    try:
        return int(r.llen(JOBS_QUEUE))
    except Exception:  # noqa: BLE001
        return 0

# Mapeamento de formato → extensão pyembroidery / Ink/Stitch
FORMAT_MAP: dict[str, str] = {
    "DST": "dst",
    "PES": "pes",
    "JEF": "jef",
}

SCALE_SVG_TO_EMB = 10  # 1 mm SVG → 10 unidades pyembroidery (décimos de mm)


# ── Preview: EmbPattern → SVG de linhas de ponto ──────────────────────────────

# comandos que interrompem uma linha contínua de pontos. IMPORTANTE:
# pyembroidery.COLOR_BREAK (226) é o comando de ALTO NÍVEL usado só ao montar
# um EmbPattern em memória (era o que o motor caseiro antigo fazia); ao
# LER um arquivo real (DST/PES gerado pelo Ink/Stitch), a troca de cor vem
# como o comando de BAIXO NÍVEL pyembroidery.COLOR_CHANGE (5) — confirmado
# lendo um PES real de volta (empiricamente, não por doc). Sem isso, o
# preview/simulador não detectava NENHUMA troca de cor em arquivos reais.
_BREAK_COMMANDS = {
    pyembroidery.JUMP,
    pyembroidery.COLOR_BREAK,
    pyembroidery.COLOR_CHANGE,
    pyembroidery.STOP,
    pyembroidery.TRIM,
    pyembroidery.END,
}
_COLOR_CHANGE_COMMANDS = {pyembroidery.COLOR_BREAK, pyembroidery.COLOR_CHANGE}


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
            if cmd in _COLOR_CHANGE_COMMANDS:
                color_index += 1
    flush(color_index)

    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{viewbox}">\n  '
        + "\n  ".join(polylines)
        + "\n</svg>"
    )


# comando pyembroidery → código compacto no JSON do player (EXP-2). Cobre
# tanto COLOR_BREAK (alto nível) quanto COLOR_CHANGE (baixo nível, o que
# aparece de fato ao ler um DST/PES real de volta) — ver nota em _BREAK_COMMANDS.
_STITCH_CMD_CODE: dict[int, int] = {
    pyembroidery.STITCH: 0,
    pyembroidery.JUMP: 1,
    pyembroidery.COLOR_BREAK: 2,
    pyembroidery.COLOR_CHANGE: 2,
    pyembroidery.TRIM: 3,
    pyembroidery.END: 4,
}


def pattern_to_stitch_json(pattern: pyembroidery.EmbPattern, viewbox: str) -> dict[str, Any]:
    """
    Serializa o EmbPattern (mesmo gerado pelo DST/PES do Ink/Stitch) na
    sequência ordenada de pontos, para o player de simulação (EXP-2) animar
    no front — em vez de um SVG achatado (pattern_to_preview_svg), aqui cada
    ponto vira [x_mm, y_mm, cmdCode] (arrays, não objetos, pra manter o JSON
    compacto em designs com muitos milhares de pontos).
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


def _pattern_from_bytes(data: bytes, ext: str) -> pyembroidery.EmbPattern:
    """
    Lê bytes de um arquivo de bordado (gerado pelo Ink/Stitch) via
    pyembroidery — precisa de um arquivo real com a extensão certa, porque
    pyembroidery escolhe o parser pela extensão do nome do arquivo.
    """
    with tempfile.NamedTemporaryFile(suffix=f".{ext}", delete=False) as f:
        f.write(data)
        tmp_path = f.name
    try:
        return pyembroidery.read(tmp_path)
    finally:
        os.unlink(tmp_path)


# ── Worker loop ───────────────────────────────────────────────────────────────

def process_job(r: redis.Redis, job_data: dict[str, Any], queue_depth: int = 0) -> None:
    job_id: str = job_data["jobId"]

    # Dispatch por tipo: "export" (default, SVG → bordado), "analyze"
    # (imagem → SVG, ver analyze.py), "preview" (SVG → linhas de ponto) ou
    # "stitch_data" (SVG → sequência de pontos em JSON, para o player EXP-2).
    job_type = job_data.get("type", "export")
    if job_type == "analyze":
        process_analyze_job(r, job_data, queue_depth)
        return
    if job_type == "preview":
        process_preview_job(r, job_data, queue_depth)
        return
    if job_type == "stitch_data":
        process_stitch_data_job(r, job_data, queue_depth)
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

    t0 = time.perf_counter()
    try:
        svg_text = svg_path.read_text(encoding="utf-8")
        t_ink = time.perf_counter()
        result_bytes = run_inkstitch(svg_text, formats=(ext,))[ext]
        inkstitch_ms = round((time.perf_counter() - t_ink) * 1000)

        # Conta pontos pra validar (mesmo critério de antes: SVG sem paths
        # válidos = erro) — os bytes gravados são os ORIGINAIS do Ink/Stitch,
        # não uma reserialização via pyembroidery (preserva fidelidade ao
        # que a máquina realmente vai bordar).
        pattern = _pattern_from_bytes(result_bytes, ext)
        if len(pattern.stitches) == 0:
            _publish_error(r, job_id, "Nenhum ponto gerado — SVG pode não ter paths válidos")
            return

        output_path.write_bytes(result_bytes)
        stitches = len(pattern.stitches)
        duration_ms = round((time.perf_counter() - t0) * 1000)
        log.info(
            "Job %s concluído → %s (%d pontos, %d ms, inkstitch %d ms)",
            job_id, output_file, stitches, duration_ms, inkstitch_ms,
        )
        report_message(
            "worker.export.done",
            duration_ms=duration_ms, inkstitch_ms=inkstitch_ms,
            stitches=stitches, format=fmt, bytes=len(result_bytes),
            queue_depth=queue_depth,
        )

        result = json.dumps({"jobId": job_id, "status": "done", "outputFile": output_file})
        r.publish(RESULTS_CHANNEL, result)

    except Exception as exc:
        log.exception("Job %s falhou", job_id)
        report_error()
        _publish_error(r, job_id, str(exc))


def process_analyze_job(r: redis.Redis, job_data: dict[str, Any], queue_depth: int = 0) -> None:
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

    t0 = time.perf_counter()
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
        duration_ms = round((time.perf_counter() - t0) * 1000)
        log.info(
            "Análise %s concluída → %s (%d bytes, %d ms)",
            job_id, output_file, len(svg), duration_ms,
        )
        report_message(
            "worker.analyze.done",
            duration_ms=duration_ms, svg_bytes=len(svg),
            colors=params.colors, queue_depth=queue_depth,
        )

        result = json.dumps({"jobId": job_id, "status": "done", "outputFile": output_file})
        r.publish(RESULTS_CHANNEL, result)

    except Exception as exc:
        log.exception("Análise %s falhou", job_id)
        report_error()
        _publish_error(r, job_id, str(exc))


def process_preview_job(r: redis.Redis, job_data: dict[str, Any], queue_depth: int = 0) -> None:
    """
    Preview: SVG-entrada (um elemento anotado com inkstitch, no viewBox
    original) → Ink/Stitch (PES, que embute a cor real da linha — DST não
    tem cor embutida) → SVG de linhas em EXPORTS_DIR.
    """
    job_id: str = job_data["jobId"]
    svg_file: str = job_data["svgFile"]  # {jobId}.in.svg gravado pela API

    log.info("Processando preview %s  svg=%s", job_id, svg_file)

    svg_path = EXPORTS_DIR / svg_file
    if not svg_path.exists():
        _publish_error(r, job_id, f"SVG de preview não encontrado: {svg_file}")
        return

    t0 = time.perf_counter()
    try:
        svg_text = svg_path.read_text(encoding="utf-8")
        t_ink = time.perf_counter()
        pes_bytes = run_inkstitch(svg_text, formats=("pes",))["pes"]
        inkstitch_ms = round((time.perf_counter() - t_ink) * 1000)
        pattern = _pattern_from_bytes(pes_bytes, "pes")
        preview_svg = pattern_to_preview_svg(pattern, _svg_viewbox(svg_path))

        output_file = f"{job_id}.svg"
        (EXPORTS_DIR / output_file).write_text(preview_svg, encoding="utf-8")
        stitches = len(pattern.stitches)
        duration_ms = round((time.perf_counter() - t0) * 1000)
        log.info(
            "Preview %s concluído → %s (%d pontos, %d ms, inkstitch %d ms)",
            job_id, output_file, stitches, duration_ms, inkstitch_ms,
        )
        report_message(
            "worker.preview.done",
            duration_ms=duration_ms, inkstitch_ms=inkstitch_ms,
            stitches=stitches, queue_depth=queue_depth,
        )

        r.publish(RESULTS_CHANNEL, json.dumps({"jobId": job_id, "status": "done", "outputFile": output_file}))
    except Exception as exc:
        log.exception("Preview %s falhou", job_id)
        report_error()
        _publish_error(r, job_id, str(exc))


def process_stitch_data_job(r: redis.Redis, job_data: dict[str, Any], queue_depth: int = 0) -> None:
    """
    Dados do player de simulação (EXP-2): SVG do projeto inteiro (mesmo
    arquivo que alimenta o export) → Ink/Stitch (PES, cor embutida) →
    sequência de pontos em JSON — o que se anima no player é fiel ao que a
    máquina borda de verdade (mesmo motor do export, só formato diferente
    pra recuperar as cores).
    """
    job_id: str = job_data["jobId"]
    svg_file: str = job_data["svgFile"]

    log.info("Processando stitch_data %s  svg=%s", job_id, svg_file)

    svg_path = EXPORTS_DIR / svg_file
    if not svg_path.exists():
        _publish_error(r, job_id, f"SVG não encontrado: {svg_file}")
        return

    t0 = time.perf_counter()
    try:
        svg_text = svg_path.read_text(encoding="utf-8")
        t_ink = time.perf_counter()
        pes_bytes = run_inkstitch(svg_text, formats=("pes",))["pes"]
        inkstitch_ms = round((time.perf_counter() - t_ink) * 1000)
        pattern = _pattern_from_bytes(pes_bytes, "pes")

        if len(pattern.stitches) == 0:
            _publish_error(r, job_id, "Nenhum ponto gerado — SVG pode não ter paths válidos")
            return

        data = pattern_to_stitch_json(pattern, _svg_viewbox(svg_path))

        output_file = f"{job_id}.json"
        (EXPORTS_DIR / output_file).write_text(json.dumps(data), encoding="utf-8")
        stitches = len(pattern.stitches)
        duration_ms = round((time.perf_counter() - t0) * 1000)
        log.info(
            "Stitch data %s concluído → %s (%d pontos, %d ms, inkstitch %d ms)",
            job_id, output_file, stitches, duration_ms, inkstitch_ms,
        )
        report_message(
            "worker.stitch_data.done",
            duration_ms=duration_ms, inkstitch_ms=inkstitch_ms,
            stitches=stitches, queue_depth=queue_depth,
        )

        r.publish(RESULTS_CHANNEL, json.dumps({"jobId": job_id, "status": "done", "outputFile": output_file}))
    except Exception as exc:
        log.exception("Stitch data %s falhou", job_id)
        report_error()
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

            # Backlog restante na fila (este job já foi retirado pelo BLPOP).
            # Vai junto na telemetria de cada job e dispara um alerta quando
            # cresce demais — sinal de que o worker não está dando conta.
            queue_depth = _queue_depth(r)
            if queue_depth >= QUEUE_DEPTH_WARN:
                log.warning("Fila '%s' profunda: %d jobs aguardando", JOBS_QUEUE, queue_depth)
                report_message("worker.queue.deep", level="warning", queue_depth=queue_depth)

            process_job(r, job_data, queue_depth)

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
            report_error()
            time.sleep(1)


if __name__ == "__main__":
    main()
