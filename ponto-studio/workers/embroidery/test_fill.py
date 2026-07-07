"""
Testes do preenchimento hole-aware (fill_path_with_stitches) e do render de
preview (pattern_to_preview_svg). Rodar no container:
  docker compose run --rm worker python -m unittest test_fill -v
"""

import unittest

from svgpathtools import parse_path

from worker import (
    SCALE_SVG_TO_EMB,
    fill_path_with_stitches,
    pattern_to_preview_svg,
    svg_to_embroidery,
)


def point_in_hole(stitches, cx, cy, radius):
    """True se algum ponto cair dentro do círculo (buraco) de centro (cx,cy)."""
    return any((x - cx) ** 2 + (y - cy) ** 2 < radius**2 for x, y in stitches)


class TestHoleAwareFill(unittest.TestCase):
    def test_anel_nao_preenche_o_miolo(self):
        # anel: quadrado externo 0..100 com furo quadrado 35..65 (subpath reverso)
        ring = parse_path(
            "M 0 0 L 100 0 L 100 100 L 0 100 Z "
            "M 35 35 L 35 65 L 65 65 L 65 35 Z"
        )
        stitches = fill_path_with_stitches(ring, spacing_mm=3.0, angle_deg=0.0)
        self.assertGreater(len(stitches), 0)
        # nenhum ponto no centro do furo (raio 12 dentro do furo de lado 30)
        self.assertFalse(
            point_in_hole(stitches, 50, 50, 12),
            "o miolo do anel foi preenchido — buraco ignorado",
        )
        # mas há pontos na coroa (ex: perto de x=10)
        self.assertTrue(point_in_hole(stitches, 10, 50, 6))

    def test_disco_solido_preenche_o_centro(self):
        disk = parse_path("M 0 0 L 100 0 L 100 100 L 0 100 Z")
        stitches = fill_path_with_stitches(disk, spacing_mm=3.0, angle_deg=0.0)
        self.assertTrue(point_in_hole(stitches, 50, 50, 6))

    def test_angulo_45_ainda_respeita_buraco(self):
        ring = parse_path(
            "M 0 0 L 100 0 L 100 100 L 0 100 Z "
            "M 35 35 L 35 65 L 65 65 L 65 35 Z"
        )
        stitches = fill_path_with_stitches(ring, spacing_mm=3.0, angle_deg=45.0)
        self.assertFalse(point_in_hole(stitches, 50, 50, 10))


class TestPreviewSvg(unittest.TestCase):
    def _pattern_from_svg(self, svg, tmp_path):
        tmp_path.write_text(svg, encoding="utf-8")
        return svg_to_embroidery(tmp_path, "dst")

    def test_render_gera_polylines_com_cor_e_viewbox(self):
        import tempfile
        from pathlib import Path as P

        svg = (
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">'
            '<path d="M 10 10 L 90 10 L 90 90 L 10 90 Z" fill="#ff0000" '
            'inkstitch:angle="0" inkstitch:fill_method="tatami_fill" '
            'inkstitch:line_distance="4" xmlns:inkstitch="http://inkstitch.org/namespace"/>'
            "</svg>"
        )
        with tempfile.TemporaryDirectory() as tmp:
            p = P(tmp) / "in.svg"
            pattern = self._pattern_from_svg(svg, p)
            out = pattern_to_preview_svg(pattern, "0 0 100 100")
        self.assertIn("<polyline", out)
        self.assertIn("#ff0000", out.lower())
        self.assertIn('viewBox="0 0 100 100"', out)

    def test_preview_coords_dentro_do_viewbox(self):
        import re
        import tempfile
        from pathlib import Path as P

        svg = (
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">'
            '<path d="M 10 10 L 90 10 L 90 90 L 10 90 Z" fill="#00aa00" '
            'inkstitch:angle="0" inkstitch:fill_method="tatami_fill" '
            'inkstitch:line_distance="5" xmlns:inkstitch="http://inkstitch.org/namespace"/>'
            "</svg>"
        )
        with tempfile.TemporaryDirectory() as tmp:
            p = P(tmp) / "in.svg"
            pattern = self._pattern_from_svg(svg, p)
            out = pattern_to_preview_svg(pattern, "0 0 100 100")
        nums = [float(n) for n in re.findall(r"[-\d.]+", " ".join(re.findall(r'points="([^"]+)"', out)))]
        self.assertTrue(nums, "sem pontos na preview")
        self.assertTrue(all(-1 <= n <= 101 for n in nums), "pontos fora do viewBox — escala errada")


if __name__ == "__main__":
    unittest.main()
