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


class TestTatamiStitchLengthVsRowSpacing(unittest.TestCase):
    """
    Motor novo (modelo Ink/Stitch): line_distance (espaçamento ENTRE linhas)
    e max_stitch_length (comprimento do ponto AO LONGO da linha) são
    parâmetros distintos — antes um só valor controlava os dois, o que dava
    ou pontos minúsculos ou linhas esparsas com vãos.
    """

    SQUARE_D = "M0 0 H20 V20 H0 Z"  # quadrado 20x20mm

    def _pattern(self, line_distance_mm: float, max_stitch_length_mm: float) -> pyembroidery.EmbPattern:
        svg = (
            f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkstitch="http://inkstitch.org/namespace" '
            f'viewBox="0 0 20 20"><path d="{self.SQUARE_D}" fill="#ff0000" '
            f'inkstitch:fill_method="tatami_fill" inkstitch:angle="0" '
            f'inkstitch:line_distance="{line_distance_mm}mm" '
            f'inkstitch:max_stitch_length="{max_stitch_length_mm}mm" /></svg>'
        )
        return _run_svg_to_embroidery(svg)

    def test_linhas_finas_com_pontos_longos_da_mais_linhas_que_pontos_por_linha(self):
        # espaçamento 0.4mm entre linhas, pontos de 3mm ao longo da linha:
        # ~20/0.4=50 linhas, ~20/3≈7 pontos por linha → total bem menor que
        # se o comprimento do ponto também fosse 0.4mm (que daria ~50 por linha)
        pattern = self._pattern(line_distance_mm=0.4, max_stitch_length_mm=3.0)
        n = sum(1 for s in pattern.stitches if s[2] == pyembroidery.STITCH)
        # com o motor antigo (spacing único) o mesmo desenho gerava ~2500+ pontos
        # (50 linhas × ~50 pontos); com length/spacing separados, bem menos
        self.assertLess(n, 800, f"pontos demais ({n}) — max_stitch_length não separado do line_distance")
        self.assertGreater(n, 200, f"poucas linhas geradas ({n}) para spacing=0.4mm em área 20x20mm")

    def test_espacamento_das_linhas_bate_com_line_distance(self):
        pattern = self._pattern(line_distance_mm=2.0, max_stitch_length_mm=3.0)
        ys = sorted({round(s[1] / SCALE_SVG_TO_EMB, 3) for s in pattern.stitches if s[2] == pyembroidery.STITCH})
        # distâncias entre linhas consecutivas devem rondar 2.0mm (spacing), não 3.0mm (stitch length)
        diffs = [b - a for a, b in zip(ys, ys[1:]) if b - a > 0.5]
        self.assertTrue(diffs, "sem linhas distintas detectadas")
        self.assertTrue(all(1.5 < d < 2.5 for d in diffs), f"espaçamento entre linhas fora do esperado: {diffs[:5]}")


class TestStaggerAndDedupe(unittest.TestCase):
    """
    Grating via shapely: interseções viram SEGMENTOS (não pares de pontos de
    cruzamento), então uma linha de varredura cruzando exatamente um vértice
    do path não quebra o pareamento par-ímpar — regressão do motor antigo,
    onde isso descolava a costura pra fora da forma.
    """

    def test_vertice_exatamente_sobre_a_varredura_nao_produz_ponto_fora_do_bbox(self):
        # triângulo com um vértice em y=5 exatamente — varredura horizontal a
        # cada 1mm cruza esse vértice numa das linhas
        TRIANGLE_D = "M0 0 L10 5 L0 10 Z"
        svg = (
            '<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkstitch="http://inkstitch.org/namespace" '
            f'viewBox="0 0 10 10"><path d="{TRIANGLE_D}" fill="#ff0000" '
            'inkstitch:fill_method="tatami_fill" inkstitch:angle="0" '
            'inkstitch:line_distance="1mm" inkstitch:max_stitch_length="2mm" /></svg>'
        )
        pattern = _run_svg_to_embroidery(svg)
        xs = [s[0] / SCALE_SVG_TO_EMB for s in pattern.stitches if s[2] == pyembroidery.STITCH]
        ys = [s[1] / SCALE_SVG_TO_EMB for s in pattern.stitches if s[2] == pyembroidery.STITCH]
        self.assertGreater(len(xs), 0)
        # tolerância pequena pro overshoot dos extremos do segmento
        self.assertTrue(all(-0.5 <= x <= 10.5 for x in xs), f"ponto fora do bbox em x: {xs}")
        self.assertTrue(all(-0.5 <= y <= 10.5 for y in ys), f"ponto fora do bbox em y: {ys}")

    def test_stagger_desloca_penetracoes_entre_linhas_consecutivas(self):
        # Toda linha SEMPRE começa exatamente na borda do segmento (lo/hi) —
        # isso é intencional (cobertura completa da borda). O stagger atua nas
        # penetrações INTERIORES: o 2º ponto de cada linha (1ª penetração
        # depois da borda) deve variar de posição entre linhas, não ficar
        # sempre no mesmo x — senão vira "veludo canelado" (sulcos alinhados).
        from worker import fill_path_with_stitches
        from svgpathtools import parse_path

        path = parse_path("M0 0 H20 V20 H0 Z")
        pts = fill_path_with_stitches(path, spacing_mm=1.0, angle_deg=0.0, stitch_len_mm=3.0)

        rows: dict[float, list[float]] = {}
        for x, y, _jump in pts:
            rows.setdefault(round(y, 2), []).append(round(x, 3))

        second_points = [sorted(xs)[1] for xs in rows.values() if len(xs) > 2]
        distinct = {round(s, 1) for s in second_points}
        self.assertGreater(
            len(distinct), 1,
            f"2º ponto de cada linha sempre no mesmo x ({distinct}) — stagger não variou",
        )


class TestUnderlaySpacingFactor(unittest.TestCase):
    """
    Underlay tatami usa 3× o espaçamento do preenchimento do topo (modelo
    Ink/Stitch) — antes era um valor fixo (2.0mm) quase tão denso quanto o
    topo, e o desenho saía costurado duas vezes em direções cruzadas (relato
    do usuário: "parece imprimir dois lados ao mesmo tempo, duas agulhas").
    """

    def test_espacamento_do_underlay_e_3x_o_do_topo(self):
        # Testa o mecanismo diretamente (fill_path_with_stitches), sem passar
        # pelo SVG/worker — evita o ruído do próprio stagger do topo, que por
        # si só já produz múltiplas posições de x (não relacionadas ao underlay).
        from worker import fill_path_with_stitches, UNDERLAY_SPACING_FACTOR
        from svgpathtools import parse_path

        path = parse_path("M0 0 H20 V20 H0 Z")
        top_spacing = 0.4
        top = fill_path_with_stitches(path, spacing_mm=top_spacing, angle_deg=0.0, stitch_len_mm=3.0)
        underlay = fill_path_with_stitches(
            path, spacing_mm=top_spacing * UNDERLAY_SPACING_FACTOR, angle_deg=90.0, stitch_len_mm=3.0
        )

        def count_rows(pts, coord_index: int) -> int:
            return len({round(p[coord_index], 1) for p in pts})

        top_rows = count_rows(top, 1)       # angle=0 → linhas avançam em y
        underlay_rows = count_rows(underlay, 0)  # angle=90 (perpendicular) → linhas avançam em x

        self.assertLess(
            underlay_rows, top_rows / 2,
            f"underlay não está bem mais esparso que o topo: top={top_rows} linhas, underlay={underlay_rows} linhas",
        )


class TestSatinCenterWalkUnderlay(unittest.TestCase):
    """Underlay do cetim = center-walk (corrida pelo centro), não crosshatch."""

    def test_centerwalk_fica_dentro_da_forma(self):
        from worker import satin_centerwalk_underlay
        from svgpathtools import parse_path

        path = parse_path("M0 0 H10 V20 H0 Z")  # coluna 10x20mm
        pts = satin_centerwalk_underlay(path, angle_deg=0.0)
        self.assertGreater(len(pts), 0)
        for x, y, _jump in pts:
            self.assertTrue(-0.5 <= x <= 10.5, f"center-walk fora da forma em x={x}")
            self.assertTrue(-0.5 <= y <= 20.5, f"center-walk fora da forma em y={y}")
        # é uma costura pelo CENTRO — x deve ficar perto de 5 (meio da largura 10)
        xs = [x for x, _y, _j in pts]
        self.assertTrue(all(abs(x - 5.0) < 1.0 for x in xs), f"center-walk fugiu do centro: {xs}")

    def test_centerwalk_usado_no_underlay_do_cetim_end_to_end(self):
        svg = (
            '<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkstitch="http://inkstitch.org/namespace" '
            'viewBox="0 0 10 20"><path d="M0 0 H10 V20 H0 Z" fill="#ff0000" '
            'inkstitch:fill_method="contour_fill" inkstitch:angle="0" '
            'inkstitch:line_distance="0.4mm" inkstitch:underlay="true" /></svg>'
        )
        pattern = _run_svg_to_embroidery(svg)
        xs = [s[0] / SCALE_SVG_TO_EMB for s in pattern.stitches if s[2] == pyembroidery.STITCH]
        # com centro-walk, deve haver pontos no MEIO (perto de x=5), diferente do
        # zigue-zague puro do cetim (que só teria pontos nas bordas x≈0/x≈10)
        middle = [x for x in xs if 3 < x < 7]
        self.assertGreater(len(middle), 0, "sem pontos no centro — underlay não é center-walk")


class TestRotationAppliedByWorker(unittest.TestCase):
    """
    A2: a rotação da parte (persistida no tldraw) é embutida via
    Path.rotated() no worker, lendo ponto:rotation* — o SVG emitido pela API
    usa esse atributo POR PATH (não <g transform>, que svg2paths2 ignora).
    """

    def test_rotacao_90_troca_largura_por_altura_no_bbox_dos_pontos(self):
        # retângulo 4x20mm (bem mais alto que largo) rotacionado 90° em volta
        # do seu centro (2, 10) — o resultado deve ficar mais largo que alto
        svg = (
            '<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkstitch="http://inkstitch.org/namespace" '
            'xmlns:ponto="https://ponto.studio/ns" viewBox="0 0 20 20">'
            '<path d="M0 0 H4 V20 H0 Z" fill="#ff0000" '
            'inkstitch:fill_method="tatami_fill" inkstitch:angle="0" '
            'inkstitch:line_distance="1mm" inkstitch:max_stitch_length="2mm" '
            'ponto:rotation="90" ponto:rotation_cx="2" ponto:rotation_cy="10" /></svg>'
        )
        pattern = _run_svg_to_embroidery(svg)
        xs = [s[0] / SCALE_SVG_TO_EMB for s in pattern.stitches if s[2] == pyembroidery.STITCH]
        ys = [s[1] / SCALE_SVG_TO_EMB for s in pattern.stitches if s[2] == pyembroidery.STITCH]
        width = max(xs) - min(xs)
        height = max(ys) - min(ys)
        self.assertGreater(width, height, f"rotação 90° não trocou largura/altura: w={width} h={height}")
        self.assertGreater(width, 15, f"largura pós-rotação menor que o esperado (~20mm): {width}")
        self.assertLess(height, 8, f"altura pós-rotação maior que o esperado (~4mm): {height}")

    def test_sem_rotacao_bbox_permanece_original(self):
        svg = (
            '<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkstitch="http://inkstitch.org/namespace" '
            'viewBox="0 0 20 20"><path d="M0 0 H4 V20 H0 Z" fill="#ff0000" '
            'inkstitch:fill_method="tatami_fill" inkstitch:angle="0" '
            'inkstitch:line_distance="1mm" inkstitch:max_stitch_length="2mm" /></svg>'
        )
        pattern = _run_svg_to_embroidery(svg)
        xs = [s[0] / SCALE_SVG_TO_EMB for s in pattern.stitches if s[2] == pyembroidery.STITCH]
        ys = [s[1] / SCALE_SVG_TO_EMB for s in pattern.stitches if s[2] == pyembroidery.STITCH]
        self.assertLess(max(xs) - min(xs), 8)
        self.assertGreater(max(ys) - min(ys), 15)


if __name__ == "__main__":
    unittest.main()
