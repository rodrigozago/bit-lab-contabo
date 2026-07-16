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


class TestStitchTypesAreDistinct(unittest.TestCase):
    """
    STI-2: cada tipo de ponto tem que gerar um padrão DIFERENTE — antes,
    cetim caía no mesmo preenchimento do tatami e o running ignorava o
    comprimento de ponto configurado.
    """

    SQUARE_D = "M0 0 H10 V10 H0 Z"  # quadrado 10x10 mm

    def _pattern(self, attrs: str) -> pyembroidery.EmbPattern:
        svg = (
            f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkstitch="http://inkstitch.org/namespace" '
            f'viewBox="0 0 10 10"><path d="{self.SQUARE_D}" fill="#ff0000" {attrs} /></svg>'
        )
        return _run_svg_to_embroidery(svg)

    def test_cetim_e_zigue_zague_borda_a_borda(self):
        # cetim: cada linha de varredura tem SÓ 2 pontos (as duas bordas) —
        # todos os pontos ficam nas bordas x=0 ou x=10 (varredura a 0°).
        # Tolerância 0.4 acomoda as travas (±0.3mm em volta do 1º/último ponto).
        pattern = self._pattern(
            'inkstitch:fill_method="contour_fill" inkstitch:line_distance="1mm" inkstitch:angle="0"'
        )
        xs = [s[0] / SCALE_SVG_TO_EMB for s in pattern.stitches if s[2] == pyembroidery.STITCH]
        self.assertGreater(len(xs), 0)
        for x in xs:
            self.assertTrue(
                abs(x) < 0.4 or abs(x - 10) < 0.4,
                f"ponto de cetim no MEIO da forma (x={x}) — deveria ir borda a borda",
            )

    def test_tatami_preenche_o_interior(self):
        # tatami: tem pontos NO MEIO da forma (não só nas bordas)
        pattern = self._pattern(
            'inkstitch:fill_method="tatami_fill" inkstitch:line_distance="1mm" inkstitch:angle="0"'
        )
        xs = [s[0] / SCALE_SVG_TO_EMB for s in pattern.stitches if s[2] == pyembroidery.STITCH]
        interior = [x for x in xs if 2 < x < 8]
        self.assertGreater(len(interior), 0, "tatami sem pontos no interior da forma")

    def test_running_respeita_comprimento_do_ponto(self):
        # perímetro 40mm / 2mm por ponto ≈ 21 pontos + 6 de travas
        # (tie-in/tie-off, 3 cada) — não os 128 fixos de antes
        pattern = self._pattern(
            'inkstitch:stroke_method="running_stitch" inkstitch:running_stitch_length="2mm"'
        )
        n = sum(1 for s in pattern.stitches if s[2] in (pyembroidery.STITCH, pyembroidery.JUMP))
        self.assertLess(abs(n - 27), 5, f"esperava ~27 pontos (40mm/2mm + travas), veio {n}")

    def test_running_pula_entre_subpaths_desconectados(self):
        # dois quadrados desconectados no mesmo "d": o segundo tem que começar com JUMP
        svg = (
            '<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkstitch="http://inkstitch.org/namespace" '
            'viewBox="0 0 30 10"><path d="M0 0 H10 V10 H0 Z M20 0 H30 V10 H20 Z" fill="#ff0000" '
            'inkstitch:stroke_method="running_stitch" inkstitch:running_stitch_length="2mm" /></svg>'
        )
        pattern = _run_svg_to_embroidery(svg)
        jumps = sum(1 for s in pattern.stitches if s[2] == pyembroidery.JUMP)
        self.assertGreaterEqual(jumps, 2, "subpath desconectado sem JUMP — agulha costura ponte")


class TestSti3UnderlayPullCompLocks(unittest.TestCase):
    """STI-3: underlay, pull compensation e travas (tie-in/tie-off)."""

    SQUARE_D = "M0 0 H10 V10 H0 Z"

    def _pattern(self, attrs: str) -> pyembroidery.EmbPattern:
        svg = (
            f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkstitch="http://inkstitch.org/namespace" '
            f'viewBox="0 0 10 10"><path d="{self.SQUARE_D}" fill="#ff0000" {attrs} /></svg>'
        )
        return _run_svg_to_embroidery(svg)

    BASE = 'inkstitch:fill_method="tatami_fill" inkstitch:line_distance="1mm" inkstitch:angle="0"'

    def test_pull_compensation_alarga_o_desenho(self):
        # comp=0.5 estica cada linha 0.5mm pra cada lado → bbox ~1mm mais largo
        def width(attrs: str) -> float:
            pattern = self._pattern(attrs)
            xs = [s[0] / SCALE_SVG_TO_EMB for s in pattern.stitches if s[2] == pyembroidery.STITCH]
            return max(xs) - min(xs)

        base_w = width(self.BASE)
        comp_w = width(f'{self.BASE} inkstitch:pull_compensation_mm="0.5"')
        self.assertGreater(comp_w, base_w + 0.6, f"pull comp sem efeito: {base_w} → {comp_w}")

    def test_underlay_adiciona_pontos_sem_trocar_de_linha(self):
        base = self._pattern(self.BASE)
        with_underlay = self._pattern(f'{self.BASE} inkstitch:underlay="true"')
        n_base = sum(1 for s in base.stitches if s[2] == pyembroidery.STITCH)
        n_under = sum(1 for s in with_underlay.stitches if s[2] == pyembroidery.STITCH)
        self.assertGreater(n_under, n_base, "underlay não adicionou pontos")
        # underlay é a mesma cor — nenhuma troca de linha extra
        breaks = sum(1 for s in with_underlay.stitches if s[2] == pyembroidery.COLOR_BREAK)
        self.assertEqual(breaks, 0)
        self.assertEqual(len(with_underlay.threadlist), 1)

    def test_travas_no_inicio_e_fim_de_cada_bloco_de_cor(self):
        # dois blocos de cor → cada um com tie-in e tie-off: sequências de
        # 3 pontos consecutivos e próximos (offsets de trava são ±0.3mm, logo
        # até 0.6mm entre pontos adjacentes — bem abaixo do espaçamento de
        # 1mm do preenchimento normal, que não deve ser confundido com trava)
        svg = (
            '<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkstitch="http://inkstitch.org/namespace" '
            'viewBox="0 0 30 10">'
            f'<path d="M0 0 H10 V10 H0 Z" fill="#ff0000" {self.BASE} />'
            f'<path d="M20 0 H30 V10 H20 Z" fill="#0000ff" {self.BASE} />'
            "</svg>"
        )
        pattern = _run_svg_to_embroidery(svg)

        def lock_runs(stitches) -> int:
            """Conta corridas de 3+ STITCHes consecutivos dentro de 0.7mm."""
            runs = tight = 0
            prev = None
            for x, y, cmd in stitches:
                if cmd == pyembroidery.STITCH and prev is not None:
                    dist = ((x - prev[0]) ** 2 + (y - prev[1]) ** 2) ** 0.5 / SCALE_SVG_TO_EMB
                    tight = tight + 1 if dist <= 0.7 else 0
                    if tight == 2:
                        runs += 1
                else:
                    tight = 0
                prev = (x, y) if cmd == pyembroidery.STITCH else None
            return runs

        # 2 blocos × (tie-in + tie-off) = pelo menos 4 travas
        self.assertGreaterEqual(lock_runs(pattern.stitches), 4)


class TestSatinTatamiHoleParity(unittest.TestCase):
    """
    Cetim (zigue-zague borda-a-borda) e tatami (preenchimento par-ímpar)
    devem respeitar buracos igualmente. Cobre o relato do usuário de que o
    cetim "não deixava o espaço vazado das letras".
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
