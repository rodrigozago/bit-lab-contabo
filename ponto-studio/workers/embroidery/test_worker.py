"""
Testes do worker (worker.py) que não dependem de imagem/vtracer.
Rodar no container: docker compose run --rm worker python -m unittest test_worker -v
"""

import os
import tempfile
import unittest
from pathlib import Path

import pyembroidery

from worker import SCALE_SVG_TO_EMB, pattern_to_stitch_json, svg_to_embroidery


def make_two_color_pattern() -> pyembroidery.EmbPattern:
    """1 cor vermelha (2 pontos) + JUMP + COLOR_BREAK + 1 cor azul (2 pontos) + END."""
    pattern = pyembroidery.EmbPattern()

    red = pyembroidery.EmbThread()
    red.color = 0xFF0000
    pattern.add_thread(red)

    blue = pyembroidery.EmbThread()
    blue.color = 0x0000FF
    pattern.add_thread(blue)

    scale = SCALE_SVG_TO_EMB
    pattern.add_stitch_absolute(pyembroidery.JUMP, 0 * scale, 0 * scale)
    pattern.add_stitch_absolute(pyembroidery.STITCH, 10 * scale, 5 * scale)
    pattern.add_stitch_absolute(pyembroidery.COLOR_BREAK, 0, 0)
    pattern.add_stitch_absolute(pyembroidery.JUMP, 20 * scale, 0 * scale)
    pattern.add_stitch_absolute(pyembroidery.STITCH, 30 * scale, 5 * scale)
    pattern.add_stitch_absolute(pyembroidery.END, 0, 0)

    return pattern


class TestPatternToStitchJson(unittest.TestCase):
    def test_conta_todos_os_pontos(self):
        data = pattern_to_stitch_json(make_two_color_pattern(), "0 0 100 100")
        self.assertEqual(data["stats"]["totalStitches"], 6)
        self.assertEqual(len(data["stitches"]), 6)

    def test_conta_cores(self):
        data = pattern_to_stitch_json(make_two_color_pattern(), "0 0 100 100")
        self.assertEqual(data["stats"]["colorCount"], 2)
        self.assertEqual(data["threads"], ["#ff0000", "#0000ff"])

    def test_mapeia_comandos_para_codigo(self):
        data = pattern_to_stitch_json(make_two_color_pattern(), "0 0 100 100")
        codes = [s[2] for s in data["stitches"]]
        # JUMP, STITCH, COLOR_BREAK, JUMP, STITCH, END
        self.assertEqual(codes, [1, 0, 2, 1, 0, 4])

    def test_reescala_de_volta_pra_mm(self):
        data = pattern_to_stitch_json(make_two_color_pattern(), "0 0 100 100")
        x, y, _cmd = data["stitches"][1]  # STITCH em (10, 5) mm
        self.assertAlmostEqual(x, 10.0)
        self.assertAlmostEqual(y, 5.0)

    def test_preserva_viewbox(self):
        data = pattern_to_stitch_json(make_two_color_pattern(), "0 0 50 30")
        self.assertEqual(data["viewBox"], "0 0 50 30")

    def test_pattern_sem_fios_usa_cor_fallback(self):
        pattern = pyembroidery.EmbPattern()
        pattern.add_stitch_absolute(pyembroidery.JUMP, 0, 0)
        pattern.add_stitch_absolute(pyembroidery.END, 0, 0)
        data = pattern_to_stitch_json(pattern, "0 0 10 10")
        self.assertEqual(data["threads"], ["#333333"])


def _run_svg_to_embroidery(svg: str) -> pyembroidery.EmbPattern:
    with tempfile.TemporaryDirectory() as tmp:
        path = os.path.join(tmp, "in.svg")
        with open(path, "w", encoding="utf-8") as f:
            f.write(svg)
        return svg_to_embroidery(Path(path), "dst")


class TestSvgToEmbroideryColorGrouping(unittest.TestCase):
    """
    Regressão (relato do usuário): uma cor com várias regiões desconectadas
    (mesma camada de bordado, ver group_paths_by_color) não pode virar uma
    troca de linha por região — só quando o fill muda de verdade.
    """

    def test_mesma_cor_em_varios_paths_desconectados_e_1_thread(self):
        blobs = "".join(
            f'<path d="M{i} {i} h1 v1 h-1 Z" fill="#ff0000" '
            'inkstitch:fill_method="tatami_fill" inkstitch:line_distance="1mm" inkstitch:angle="0" />'
            for i in range(0, 34, 2)  # 17 regiões desconectadas, mesma cor
        )
        svg = (
            f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkstitch="http://inkstitch.org/namespace" '
            f'viewBox="0 0 40 40">{blobs}</svg>'
        )
        pattern = _run_svg_to_embroidery(svg)
        self.assertEqual(len(pattern.threadlist), 1)
        self.assertEqual(sum(1 for s in pattern.stitches if s[2] == pyembroidery.COLOR_BREAK), 0)

    def test_troca_de_cor_real_ainda_gera_color_break(self):
        svg = (
            '<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkstitch="http://inkstitch.org/namespace" '
            'viewBox="0 0 40 40">'
            '<path d="M0 0 h1 v1 h-1 Z" fill="#ff0000" inkstitch:fill_method="tatami_fill" '
            'inkstitch:line_distance="1mm" inkstitch:angle="0" />'
            '<path d="M35 35 h1 v1 h-1 Z" fill="#0000ff" inkstitch:fill_method="tatami_fill" '
            'inkstitch:line_distance="1mm" inkstitch:angle="0" />'
            "</svg>"
        )
        pattern = _run_svg_to_embroidery(svg)
        self.assertEqual(len(pattern.threadlist), 2)
        self.assertEqual(sum(1 for s in pattern.stitches if s[2] == pyembroidery.COLOR_BREAK), 1)


class TestSatinTatamiHoleParity(unittest.TestCase):
    """
    O worker hoje não tem um algoritmo de coluna dedicado pro cetim
    (contour_fill) — cai no mesmo preenchimento par-ímpar do tatami (STI-2) —
    então os dois devem respeitar buracos igualmente. Cobre o relato do
    usuário de que o cetim "não deixava o espaço vazado das letras".
    """

    RING_D = "M0 0 H8 V8 H0 Z M2.5 2.5 H5.5 V5.5 H2.5 Z"  # anel 8x8 com miolo 3x3

    def _hole_stitch_count(self, fill_method_attrs: str) -> tuple[int, int]:
        svg = (
            f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkstitch="http://inkstitch.org/namespace" '
            f'viewBox="0 0 8 8"><path d="{self.RING_D}" fill="#ff0000" fill-rule="evenodd" '
            f'inkstitch:angle="0" {fill_method_attrs} /></svg>'
        )
        pattern = _run_svg_to_embroidery(svg)
        total = in_hole = 0
        for x, y, cmd in pattern.stitches:
            if cmd != pyembroidery.STITCH:
                continue
            total += 1
            xm, ym = x / SCALE_SVG_TO_EMB, y / SCALE_SVG_TO_EMB
            if 2.5 < xm < 5.5 and 2.5 < ym < 5.5:
                in_hole += 1
        return total, in_hole

    def test_cetim_respeita_o_buraco(self):
        total, in_hole = self._hole_stitch_count(
            'inkstitch:fill_method="contour_fill" inkstitch:contour_strategy="inner_to_outer" '
            'inkstitch:line_distance="0.4mm"'
        )
        self.assertGreater(total, 0)
        self.assertEqual(in_hole, 0, "cetim preenchendo por cima do miolo/buraco")

    def test_tatami_respeita_o_buraco(self):
        total, in_hole = self._hole_stitch_count(
            'inkstitch:fill_method="tatami_fill" inkstitch:line_distance="0.4mm"'
        )
        self.assertGreater(total, 0)
        self.assertEqual(in_hole, 0, "tatami preenchendo por cima do miolo/buraco")


class TestFillDoesNotBridgeGaps(unittest.TestCase):
    """
    Regressão (relato do usuário: "buracos somem entre as letras" com
    densidade alta): quando uma linha de varredura cruza um vão entre duas
    formas separadas (ou os dois lados de um buraco), o ponto final de um
    segmento não pode ser costurado em linha reta até o início do próximo —
    tem que pular (JUMP). Sem o fix, isso piorava com densidade alta (mais
    linhas de varredura = mais pontos-ponte costurando por cima do vão).
    """

    # dois blocos retangulares 8x20 com um vão de x=8 a x=12 (como duas letras lado a lado)
    TWO_BLOCKS_D = "M0 0 H8 V20 H0 Z M12 0 H20 V20 H12 Z"

    def _bridging_stitches(self, spacing_mm: float) -> int:
        svg = (
            f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkstitch="http://inkstitch.org/namespace" '
            f'viewBox="0 0 20 20"><path d="{self.TWO_BLOCKS_D}" fill="#ff0000" fill-rule="evenodd" '
            f'inkstitch:angle="0" inkstitch:fill_method="tatami_fill" '
            f'inkstitch:line_distance="{spacing_mm}mm" /></svg>'
        )
        pattern = _run_svg_to_embroidery(svg)
        pts = [(x / SCALE_SVG_TO_EMB, cmd) for x, _y, cmd in pattern.stitches]
        bridges = 0
        for i in range(1, len(pts)):
            x0, _c0 = pts[i - 1]
            x1, c1 = pts[i]
            if c1 == pyembroidery.STITCH and ((x0 < 8 and x1 > 12) or (x0 > 12 and x1 < 8)):
                bridges += 1
        return bridges

    def test_espacamento_grosso_nao_costura_por_cima_do_vao(self):
        self.assertEqual(self._bridging_stitches(1.38), 0)

    def test_espacamento_fino_nao_costura_por_cima_do_vao(self):
        # é justamente com espaçamento fino (densidade alta) que o bug era
        # mais visível — muitas linhas de varredura, muitas pontes
        self.assertEqual(self._bridging_stitches(0.3), 0)


if __name__ == "__main__":
    unittest.main()
