"""
Testes do worker (worker.py) que não dependem de imagem/vtracer nem do
binário do Ink/Stitch. Rodar no container:
  docker compose run --rm worker python -m unittest test_worker -v

O motor de pontos caseiro (fill_path_with_stitches, satin_path_with_stitches,
svg_to_embroidery etc.) foi aposentado — a geração de pontos agora roda pelo
binário oficial do Ink/Stitch via subprocess (ver inkstitch_runner.py e seus
próprios testes em test_inkstitch_runner.py, que exercitam o binário de
verdade). Este arquivo cobre só as funções que SOBREVIVERAM à migração:
serialização do EmbPattern pro simulador/preview do front.
"""

import os
import tempfile
import unittest

import pyembroidery

from worker import (
    SCALE_SVG_TO_EMB,
    _pattern_from_bytes,
    pattern_to_stitch_json,
)


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


class TestPatternFromBytes(unittest.TestCase):
    """_pattern_from_bytes: escreve bytes num arquivo temporário com a
    extensão certa e lê de volta via pyembroidery (parser é escolhido pela
    extensão do nome do arquivo, não dá pra ler de BytesIO direto)."""

    def test_le_dst_gerado_por_pyembroidery(self):
        pattern = make_two_color_pattern()
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "test.dst")
            pyembroidery.write(pattern, path)
            with open(path, "rb") as f:
                data = f.read()

        read_back = _pattern_from_bytes(data, "dst")
        self.assertGreater(len(read_back.stitches), 0)

    def test_arquivo_temporario_e_removido_apos_leitura(self):
        pattern = make_two_color_pattern()
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "test.dst")
            pyembroidery.write(pattern, path)
            with open(path, "rb") as f:
                data = f.read()

        before = {f for f in os.listdir(tempfile.gettempdir()) if f.endswith(".dst")}
        _pattern_from_bytes(data, "dst")
        after = {f for f in os.listdir(tempfile.gettempdir()) if f.endswith(".dst")}
        # não deve sobrar nenhum .dst temporário novo (limpo no finally)
        self.assertEqual(before, after)


if __name__ == "__main__":
    unittest.main()
