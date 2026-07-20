"""
Runner do Ink/Stitch — Fase 0 do motor de bordado
===================================================
Roda o binário standalone do Ink/Stitch (GPLv3, https://inkstitch.org) via
subprocess pra converter um SVG anotado com atributos `inkstitch:*` num ou
mais formatos de arquivo de bordado (DST/PES/JEF/...).

Por que subprocess e não import: o Ink/Stitch é GPLv3. Rodá-lo como processo
separado (comunicação só por arquivo SVG → stdout zip) é "mera agregação" —
não torna este worker código derivado. Importar `lib.stitches` do Ink/Stitch
diretamente tornaria nosso worker GPLv3 também; por isso não fazemos isso.

O binário usa a extensão "zip" do Ink/Stitch, documentada para uso via CLI:
    inkstitch --extension=zip --format-dst=True input.svg > out.zip
O zip resultante sai direto no stdout (confirmado no .inx: <script><command
location="inx">../bin/inkstitch</command></script>). Precisa de Xvfb porque o
binário (PyInstaller, bundla wxPython/GTK) toca X mesmo em modo CLI headless.
"""

import io
import logging
import os
import re
import subprocess
import tempfile
import zipfile
from pathlib import Path

log = logging.getLogger("embroidery-worker")

INKSTITCH_BIN = os.environ.get("INKSTITCH_BIN", "/opt/inkstitch/bin/inkstitch")
INKSTITCH_TIMEOUT_S = int(os.environ.get("INKSTITCH_TIMEOUT_S", "60"))

# Versão do schema de SVG que o binário do Ink/Stitch (release v3.2.2) espera
# — ver `INKSTITCH_SVG_VERSION` em lib/update.py do próprio Ink/Stitch. Sem
# essa marca (`<inkstitch_svg_version>`), ele acha que o documento é de uma
# versão desconhecida/antiga e mostra um DIÁLOGO MODAL (wx) pedindo
# confirmação de upgrade — que trava para sempre em modo headless, sem
# nenhum erro no stderr (achado via py-spy: MainLoop parado em
# request_update_svg_version.py). Ajustar este número ao trocar de versão
# do Ink/Stitch no Dockerfile (INKSTITCH_VERSION).
INKSTITCH_SVG_VERSION = 3

_SVG_ROOT_TAG_RE = re.compile(r"(<svg\b[^>]*>)", re.IGNORECASE)


def _ensure_version_marker(svg: str) -> str:
    """Injeta <inkstitch_svg_version> logo após a tag raiz, se ainda não existir."""
    if "inkstitch_svg_version" in svg:
        return svg
    marker = f"<metadata><inkstitch_svg_version>{INKSTITCH_SVG_VERSION}</inkstitch_svg_version></metadata>"
    match = _SVG_ROOT_TAG_RE.search(svg)
    if not match:
        raise ValueError("SVG sem tag <svg> raiz reconhecível")
    return svg[: match.end()] + marker + svg[match.end():]

# Formatos aceitos pela extensão "zip" do Ink/Stitch (nome exato do param
# --format-<x>, conferido em inx/inkstitch_zip.inx do release v3.2.2).
SUPPORTED_FORMATS = {
    "pec", "pes", "exp", "dst", "jef", "vp3", "xxx", "u01", "tbf", "svg",
}


class InkstitchError(RuntimeError):
    """O binário do Ink/Stitch falhou, não respondeu, ou não gerou o formato esperado."""


def run_inkstitch(svg: str, formats: tuple[str, ...] = ("dst",)) -> dict[str, bytes]:
    """
    Converte `svg` (com atributos inkstitch:* nos <path>, unidades em mm) num
    ou mais formatos de bordado, usando o binário oficial do Ink/Stitch.

    Retorna {formato_lowercase: bytes}. Levanta InkstitchError se o processo
    falhar, estourar o timeout, ou não gerar algum dos formatos pedidos.
    """
    formats = tuple(f.lower() for f in formats)
    if not formats:
        raise ValueError("Nenhum formato pedido")
    unknown = [f for f in formats if f not in SUPPORTED_FORMATS]
    if unknown:
        raise ValueError(f"Formato(s) não suportado(s) pelo runner: {unknown}")

    with tempfile.TemporaryDirectory() as tmp:
        svg_path = Path(tmp) / "input.svg"
        svg_path.write_text(_ensure_version_marker(svg), encoding="utf-8")

        cmd = [
            "xvfb-run", "-a",
            INKSTITCH_BIN,
            "--extension=zip",
            *[f"--format-{fmt}=True" for fmt in formats],
            str(svg_path),
        ]

        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                timeout=INKSTITCH_TIMEOUT_S,
                check=False,
            )
        except subprocess.TimeoutExpired as exc:
            raise InkstitchError(
                f"Ink/Stitch não respondeu em {INKSTITCH_TIMEOUT_S}s"
            ) from exc
        except FileNotFoundError as exc:
            raise InkstitchError(
                f"Binário do Ink/Stitch (ou xvfb-run) não encontrado: {exc}"
            ) from exc

        stderr_tail = result.stderr.decode("utf-8", errors="replace")[-2000:]

        if result.returncode != 0:
            raise InkstitchError(
                f"Ink/Stitch saiu com código {result.returncode}: {stderr_tail}"
            )

        zip_bytes = result.stdout
        if not zip_bytes:
            raise InkstitchError(
                f"Ink/Stitch não gerou saída (stdout vazio). stderr: {stderr_tail}"
            )

        try:
            zf = zipfile.ZipFile(io.BytesIO(zip_bytes))
        except zipfile.BadZipFile as exc:
            raise InkstitchError(
                f"Saída do Ink/Stitch não é um zip válido. stderr: {stderr_tail}"
            ) from exc

        output: dict[str, bytes] = {}
        for fmt in formats:
            ext = f".{fmt}"
            names = [n for n in zf.namelist() if n.lower().endswith(ext)]
            if not names:
                log.warning(
                    "Ink/Stitch não gerou arquivo .%s no zip (conteúdo: %s)",
                    fmt, zf.namelist(),
                )
                continue
            output[fmt] = zf.read(names[0])

        missing = [f for f in formats if f not in output]
        if missing:
            raise InkstitchError(
                f"Formato(s) pedido(s) ausente(s) na saída do Ink/Stitch: {missing} "
                f"(zip continha: {zf.namelist()})"
            )

        return output
