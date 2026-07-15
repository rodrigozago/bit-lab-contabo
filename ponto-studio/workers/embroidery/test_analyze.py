"""
Testes do pipeline de análise local (analyze.py).
Rodar no container: docker compose run --rm worker python -m unittest test_analyze -v
"""

import os
import re
import tempfile
import unittest
import xml.etree.ElementTree as ET

import cv2
import numpy as np

from analyze import (
    SVG_NS,
    AnalyzeParams,
    analyze_image,
    bake_translate,
    cap_max_areas,
    clean_labels,
    group_paths_by_color,
    merge_similar_svg_colors,
    quantize,
)


def make_test_image(path: str, with_noise: bool = False) -> None:
    """
    Imagem sintética 300x300 com 3 cores:
      - fundo branco
      - dois quadrados vermelhos DESCONECTADOS (mesma cor → mesma camada)
      - um círculo azul
      - opcional: manchinha verde de 4x4px (ruído, deve ser absorvida)
    """
    img = np.full((300, 300, 3), 255, dtype=np.uint8)  # branco (BGR)
    img[30:110, 30:110] = (0, 0, 220)     # vermelho 1
    img[190:270, 190:270] = (0, 0, 220)   # vermelho 2 (desconectado)
    cv2.circle(img, (220, 80), 45, (200, 60, 0), -1)  # azul
    if with_noise:
        img[150:154, 20:24] = (0, 200, 0)  # mancha verde 4x4 = 0.018% da área
    cv2.imwrite(path, img)


def svg_color_groups(svg: str) -> dict[str, int]:
    """Retorna {cor: nº de paths} dos grupos <g data-layer-color> do SVG."""
    root = ET.fromstring(svg)
    groups = {}
    for g in root.iter(f"{{{SVG_NS}}}g"):
        color = g.get("data-layer-color")
        if color:
            groups[color] = len(list(g))
    return groups


class TestQuantize(unittest.TestCase):
    def test_agrupa_mesma_cor_em_um_unico_cluster(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "img.png")
            make_test_image(path)
            img = cv2.imread(path)
            labels, palette = quantize(img, n_colors=3)
            # os dois quadrados vermelhos (desconectados) devem ter o MESMO label
            label_sq1 = labels[70, 70]
            label_sq2 = labels[230, 230]
            self.assertEqual(label_sq1, label_sq2)
            self.assertEqual(len(palette), 3)

    def test_funde_clusters_de_cor_identica(self):
        # pedir 6 cores numa imagem com só 3 → clusters duplicados são fundidos
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "img.png")
            make_test_image(path)
            img = cv2.imread(path)
            _, palette = quantize(img, n_colors=6)
            self.assertLessEqual(len(palette), 4)


class TestCleanLabels(unittest.TestCase):
    def test_remove_regiao_pequena(self):
        labels = np.zeros((100, 100), dtype=np.int64)
        labels[40:44, 40:44] = 1  # 16px = 0.16% da área
        cleaned = clean_labels(labels, n_colors=2, min_region_pct=0.5)
        # a região pequena deve ser absorvida pelo fundo
        self.assertTrue((cleaned == 0).all())

    def test_mantem_regiao_grande(self):
        labels = np.zeros((100, 100), dtype=np.int64)
        labels[20:80, 20:80] = 1  # 36% da área
        cleaned = clean_labels(labels, n_colors=2, min_region_pct=0.5)
        self.assertEqual(cleaned[50, 50], 1)
        self.assertEqual(cleaned[5, 5], 0)


class TestGroupPathsByColor(unittest.TestCase):
    def test_agrupa_paths_de_mesmo_fill(self):
        svg = (
            f'<svg xmlns="{SVG_NS}" viewBox="0 0 10 10">'
            '<path d="M0 0h2v2H0Z" fill="#FF0000"/>'
            '<path d="M5 5h2v2H5Z" fill="#0000ff"/>'
            '<path d="M8 8h1v1H8Z" fill="#f00"/>'
            "</svg>"
        )
        grouped = group_paths_by_color(svg)
        groups = svg_color_groups(grouped)
        # #FF0000 e #f00 normalizam pra #ff0000 → mesmo grupo com 2 paths
        self.assertEqual(groups["#ff0000"], 2)
        self.assertEqual(groups["#0000ff"], 1)
        self.assertIn('viewBox="0 0 10 10"', grouped)


def make_lineart_image(path: str) -> None:
    """
    Line-art estilo logo: fundo branco + traços azuis finos (10px) ANTI-ALIASED
    e um "pingo de i" pequeno (14x14). Reproduz o caso real que quebrava:
    halos de anti-aliasing viravam camadas/engordavam traços, e detalhes
    pequenos eram engolidos.
    """
    img = np.full((400, 400, 3), 255, dtype=np.uint8)
    blue = (139, 30, 20)  # BGR do azul do logo
    cv2.line(img, (50, 80), (350, 80), blue, 10, lineType=cv2.LINE_AA)
    cv2.line(img, (50, 160), (350, 160), blue, 10, lineType=cv2.LINE_AA)
    cv2.line(img, (80, 220), (320, 350), blue, 10, lineType=cv2.LINE_AA)
    cv2.rectangle(img, (360, 60), (374, 74), blue, -1)  # pingo do "i"
    cv2.imwrite(path, img)


class TestLineArt(unittest.TestCase):
    """Regressão do caso real: logo com traços finos ficava borrado/fundido."""

    def _analyze(self, colors=4):
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "logo.png")
            make_lineart_image(path)
            return analyze_image(path, AnalyzeParams(colors=colors))

    def test_halos_de_antialiasing_nao_viram_camadas(self):
        # pedindo 4 cores numa line-art de 2 cores: os clusters intermediários
        # (anti-aliasing das bordas) devem ser dissolvidos → só 2 camadas
        svg = self._analyze(colors=4)
        groups = svg_color_groups(svg)
        self.assertEqual(len(groups), 2, f"halos viraram camadas: {groups}")

    def test_tracos_separados_continuam_separados(self):
        # os 3 traços + pingo são regiões desconectadas da MESMA cor →
        # 1 camada azul com pelo menos 4 paths (não podem ter sido fundidos)
        svg = self._analyze(colors=4)
        groups = svg_color_groups(svg)
        blue = [c for c in groups if int(c[5:7], 16) > 100 and int(c[1:3], 16) < 100]
        self.assertEqual(len(blue), 1, f"esperava 1 cor azulada: {groups}")
        self.assertGreaterEqual(groups[blue[0]], 4, "traços/pingo foram fundidos ou engolidos")

    def test_imagem_chapada_e_detectada(self):
        from analyze import is_flat_image, load_and_downscale
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "logo.png")
            make_lineart_image(path)
            self.assertTrue(is_flat_image(load_and_downscale(path)))
        # ruído aleatório (tipo foto) não é chapado
        rng = np.random.RandomState(0)
        noisy = rng.randint(0, 255, (200, 200, 3), dtype=np.uint8)
        self.assertFalse(is_flat_image(noisy))


class TestBakeTranslate(unittest.TestCase):
    def test_soma_offset_em_comandos_absolutos(self):
        self.assertEqual(
            bake_translate("M 0 0 L 10 5 Z", 100, 50),
            "M 100 50 L 110 55 Z",
        )

    def test_curvas_c_absolutas(self):
        self.assertEqual(
            bake_translate("M 0 0 C 1 2 3 4 5 6", 10, 20),
            "M 10 20 C 11 22 13 24 15 26",
        )

    def test_relativos_nao_sao_deslocados(self):
        self.assertEqual(
            bake_translate("M 0 0 l 5 5", 10, 10),
            "M 10 10 l 5 5",
        )

    def test_regressao_svg_final_nao_tem_transform(self):
        # Bug real: paths do vtracer vinham com transform="translate(...)" que o
        # svgpathtools ignora — o bordado saía deslocado/fora do bastidor.
        svg = (
            f'<svg xmlns="{SVG_NS}" viewBox="0 0 100 100">'
            '<path transform="translate(190,190)" d="M 0 0 L 26 0 L 26 26 L 0 26 Z" fill="#dc0000"/>'
            "</svg>"
        )
        grouped = group_paths_by_color(svg)
        self.assertNotIn("transform", grouped)
        self.assertIn("M 190 190", grouped)


class TestAnalyzeImageEndToEnd(unittest.TestCase):
    def test_tres_cores_viram_tres_camadas(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "img.png")
            make_test_image(path)
            svg = analyze_image(path, AnalyzeParams(colors=3))
            groups = svg_color_groups(svg)
            self.assertEqual(len(groups), 3)

    def test_regioes_desconectadas_mesma_cor_no_mesmo_grupo(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "img.png")
            make_test_image(path)
            svg = analyze_image(path, AnalyzeParams(colors=3))
            groups = svg_color_groups(svg)
            # o grupo avermelhado deve conter os DOIS quadrados (>= 2 paths)
            reddish = [c for c in groups if int(c[1:3], 16) > 150 and int(c[5:7], 16) < 100]
            self.assertEqual(len(reddish), 1, f"esperava 1 cor avermelhada, veio: {groups}")
            self.assertGreaterEqual(groups[reddish[0]], 2)

    def test_ruido_pequeno_e_absorvido(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "img.png")
            make_test_image(path, with_noise=True)
            svg = analyze_image(path, AnalyzeParams(colors=4, min_region_pct=0.2))
            groups = svg_color_groups(svg)
            # a mancha verde (0.018% da área) não pode virar camada
            greens = [c for c in groups if int(c[3:5], 16) > 150 and int(c[1:3], 16) < 100]
            self.assertEqual(len(greens), 0, f"mancha de ruído virou camada: {groups}")

    def test_deterministico(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "img.png")
            make_test_image(path)
            svg1 = analyze_image(path, AnalyzeParams(colors=3))
            svg2 = analyze_image(path, AnalyzeParams(colors=3))
            self.assertEqual(svg1, svg2)

    def test_parametros_sao_limitados(self):
        p = AnalyzeParams(colors=99, min_region_pct=-5, detail=0, color_tolerance=999).clamped()
        self.assertEqual(p.colors, 8)
        self.assertEqual(p.min_region_pct, 0.0)
        self.assertEqual(p.detail, 1)
        self.assertEqual(p.color_tolerance, 40.0)

    def test_colors_aceita_1_no_limite_inferior(self):
        p = AnalyzeParams(colors=0).clamped()
        self.assertEqual(p.colors, 1)


def make_single_shape_image(path: str) -> None:
    """Fundo branco + um quadrado vermelho no meio (caso de uso de colors=1)."""
    img = np.full((200, 200, 3), 255, dtype=np.uint8)
    img[60:140, 60:140] = (0, 0, 200)  # vermelho (BGR)
    cv2.imwrite(path, img)


def make_two_blobs_same_color_image(path: str) -> None:
    """Fundo branco + duas manchas vermelhas DESCONECTADAS da mesma cor."""
    img = np.full((200, 200, 3), 255, dtype=np.uint8)
    img[20:60, 20:60] = (0, 0, 200)
    img[140:180, 140:180] = (0, 0, 200)
    cv2.imwrite(path, img)


class TestExcludeBackground(unittest.TestCase):
    """colors=1 → só o primeiro plano, fundo excluído automaticamente (PONTO-29)."""

    def test_colors_1_remove_o_fundo(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "img.png")
            make_single_shape_image(path)
            svg = analyze_image(path, AnalyzeParams(colors=1))
            groups = svg_color_groups(svg)
            self.assertEqual(len(groups), 1, f"esperava só o primeiro plano: {groups}")
            color = next(iter(groups))
            r, g, b = int(color[1:3], 16), int(color[3:5], 16), int(color[5:7], 16)
            self.assertLess(min(r, g, b), 200, f"cor restante parece o fundo (quase branco): {color}")

    def test_colors_1_mantem_regioes_desconectadas_juntas(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "img.png")
            make_two_blobs_same_color_image(path)
            svg = analyze_image(path, AnalyzeParams(colors=1))
            groups = svg_color_groups(svg)
            self.assertEqual(len(groups), 1, f"esperava 1 única camada: {groups}")
            self.assertGreaterEqual(next(iter(groups.values())), 2, "as duas manchas deveriam estar no mesmo grupo")


def make_near_red_image(path: str) -> None:
    """Fundo branco + duas manchas de vermelho ligeiramente diferentes, desconectadas."""
    img = np.full((200, 200, 3), 255, dtype=np.uint8)
    img[40:100, 40:100] = (0, 0, 200)     # vermelho A
    img[100:160, 100:160] = (0, 0, 220)   # vermelho B, tom levemente diferente
    cv2.imwrite(path, img)


class TestColorTolerance(unittest.TestCase):
    """color_tolerance controla se tons próximos viram a mesma camada (PONTO-31)."""

    def test_tolerancia_zero_mantem_tons_separados(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "img.png")
            make_near_red_image(path)
            svg = analyze_image(path, AnalyzeParams(colors=3, color_tolerance=0))
            groups = svg_color_groups(svg)
            self.assertEqual(len(groups), 3, f"esperava 3 grupos com tolerância 0: {groups}")

    def test_tolerancia_alta_funde_tons_proximos(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "img.png")
            make_near_red_image(path)
            svg = analyze_image(path, AnalyzeParams(colors=3, color_tolerance=25))
            groups = svg_color_groups(svg)
            self.assertEqual(len(groups), 2, f"esperava 2 grupos (vermelhos fundidos) com tolerância alta: {groups}")


def make_near_white_shape_image(path: str) -> None:
    """Fundo branco puro + forma bege bem clara (tons próximos, caso de uso real de colors=1)."""
    img = np.full((200, 200, 3), 255, dtype=np.uint8)
    img[60:140, 60:140] = (225, 240, 245)  # bege claro (BGR), perto do branco
    cv2.imwrite(path, img)


class TestMergeSimilarSvgColors(unittest.TestCase):
    """merge_similar_svg_colors funde grupos próximos no SVG final (não só no k-means)."""

    def _four_group_svg(self) -> str:
        return (
            f'<svg xmlns="{SVG_NS}" viewBox="0 0 10 10">'
            '<g fill="#ff0000" data-layer-color="#ff0000"><path d="M0 0h1v1H0Z"/></g>'
            '<g fill="#fe0101" data-layer-color="#fe0101"><path d="M1 1h1v1H1Z"/></g>'
            '<g fill="#0000ff" data-layer-color="#0000ff"><path d="M2 2h1v1H2Z"/></g>'
            '<g fill="#00ff00" data-layer-color="#00ff00"><path d="M3 3h1v1H3Z"/></g>'
            "</svg>"
        )

    def test_tolerancia_zero_nao_altera_svg(self):
        svg = self._four_group_svg()
        self.assertEqual(merge_similar_svg_colors(svg, 0), svg)

    def test_funde_so_as_cores_proximas(self):
        svg = self._four_group_svg()
        result = merge_similar_svg_colors(svg, tolerance=5)
        groups = svg_color_groups(result)
        self.assertEqual(len(groups), 3, f"esperava #ff0000/#fe0101 fundidos, resto intacto: {groups}")

    def test_tolerancia_alta_nao_funde_cores_bem_diferentes(self):
        svg = self._four_group_svg()
        result = merge_similar_svg_colors(svg, tolerance=5)
        groups = svg_color_groups(result)
        self.assertIn("#0000ff", groups)
        self.assertIn("#00ff00", groups)


class TestExcludeBackgroundToleranciaNaoColapsaFundo(unittest.TestCase):
    """
    Regressão: com colors=1, a tolerância de cor do usuário não pode fundir
    fundo+desenho no k-means (senão a camada de fundo nunca é detectada e
    removida) — só deve valer para múltiplas cores do próprio desenho.
    """

    def test_fundo_e_forma_proximos_nao_ficam_grudados(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "img.png")
            make_near_white_shape_image(path)
            # tolerância alta o bastante para fundir fundo+forma se fosse
            # aplicada ao split fundo/desenho (o que não deve mais acontecer)
            svg = analyze_image(path, AnalyzeParams(colors=1, color_tolerance=30))
            groups = svg_color_groups(svg)
            self.assertEqual(len(groups), 1, f"esperava só o primeiro plano: {groups}")
            color = next(iter(groups))
            r, g, b = int(color[1:3], 16), int(color[3:5], 16), int(color[5:7], 16)
            self.assertFalse(r > 250 and g > 250 and b > 250, f"sobrou o fundo branco: {color}")


def make_four_color_image(path: str) -> None:
    """Fundo branco + 4 quadrados de cores bem distintas (vermelho, verde, azul, amarelo)."""
    img = np.full((200, 200, 3), 255, dtype=np.uint8)
    img[10:60, 10:60] = (0, 0, 220)     # vermelho (BGR)
    img[10:60, 140:190] = (0, 180, 0)   # verde
    img[140:190, 10:60] = (200, 0, 0)   # azul
    img[140:190, 140:190] = (0, 220, 220)  # amarelo
    cv2.imwrite(path, img)


class TestCapMaxAreas(unittest.TestCase):
    """max_areas funde as cores mais próximas até caber no teto (pedido do usuário: 'muitas áreas')."""

    def _four_group_svg(self) -> str:
        return (
            f'<svg xmlns="{SVG_NS}" viewBox="0 0 10 10">'
            '<g fill="#ff0000" data-layer-color="#ff0000"><path d="M0 0h1v1H0Z"/></g>'
            '<g fill="#fe0101" data-layer-color="#fe0101"><path d="M1 1h1v1H1Z"/></g>'
            '<g fill="#0000ff" data-layer-color="#0000ff"><path d="M2 2h1v1H2Z"/></g>'
            '<g fill="#00ff00" data-layer-color="#00ff00"><path d="M3 3h1v1H3Z"/></g>'
            "</svg>"
        )

    def test_nao_mexe_se_ja_esta_dentro_do_limite(self):
        svg = self._four_group_svg()
        result = cap_max_areas(svg, max_areas=4)
        self.assertEqual(svg_color_groups(result), svg_color_groups(svg))

    def test_funde_ate_caber_no_limite(self):
        svg = self._four_group_svg()
        result = cap_max_areas(svg, max_areas=2)
        groups = svg_color_groups(result)
        self.assertEqual(len(groups), 2, f"esperava 2 grupos: {groups}")

    def test_funde_par_mais_proximo_primeiro(self):
        # #ff0000 e #fe0101 são quase idênticos — devem virar 1 grupo antes de
        # tocar no azul/verde (bem distantes em Lab).
        svg = self._four_group_svg()
        result = cap_max_areas(svg, max_areas=3)
        groups = svg_color_groups(result)
        self.assertEqual(len(groups), 3, f"esperava 3 grupos: {groups}")
        self.assertTrue(
            "#0000ff" in groups and "#00ff00" in groups,
            f"azul/verde não deveriam ter sido fundidos: {groups}",
        )

    def test_max_areas_zero_ou_negativo_nao_altera_svg(self):
        svg = self._four_group_svg()
        self.assertEqual(cap_max_areas(svg, max_areas=0), svg)

    def test_end_to_end_limita_camadas_finais(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "img.png")
            make_four_color_image(path)
            svg = analyze_image(path, AnalyzeParams(colors=5, color_tolerance=0, max_areas=2))
            groups = svg_color_groups(svg)
            self.assertLessEqual(len(groups), 2, f"esperava no máximo 2 camadas: {groups}")

    def test_parametro_max_areas_e_limitado(self):
        p = AnalyzeParams(max_areas=99).clamped()
        self.assertEqual(p.max_areas, 8)
        p2 = AnalyzeParams(max_areas=0).clamped()
        self.assertEqual(p2.max_areas, 1)


if __name__ == "__main__":
    unittest.main()
