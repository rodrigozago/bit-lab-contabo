"""
Testes do runner do Ink/Stitch (inkstitch_runner.py).
Rodar no container: docker compose run --rm worker python -m unittest test_inkstitch_runner -v

Os testes end-to-end (que realmente chamam o binário) são pulados fora do
container — o binário só existe na imagem Docker (baixado no build,
workers/embroidery/Dockerfile). Local Windows/macOS sem Docker: só os testes
de validação de argumentos rodam.
"""

import os
import unittest

from inkstitch_runner import InkstitchError, run_inkstitch

_HAS_INKSTITCH = os.path.exists(os.environ.get("INKSTITCH_BIN", "/opt/inkstitch/bin/inkstitch"))

SQUARE_SVG = """<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkstitch="http://inkstitch.org/namespace"
     width="20mm" height="20mm" viewBox="0 0 20 20">
  <path d="M2 2 L18 2 L18 18 L2 18 Z" fill="#ff0000"
        inkstitch:fill_method="tatami_fill" inkstitch:angle="45"
        inkstitch:line_distance="0.4mm" inkstitch:max_stitch_length="3mm" />
</svg>"""


class TestArgumentValidation(unittest.TestCase):
    """Não dependem do binário — rodam em qualquer ambiente."""

    def test_formato_desconhecido_levanta_value_error(self):
        with self.assertRaises(ValueError):
            run_inkstitch(SQUARE_SVG, formats=("not-a-format",))

    def test_lista_vazia_de_formatos_levanta_value_error(self):
        with self.assertRaises(ValueError):
            run_inkstitch(SQUARE_SVG, formats=())

    def test_binario_ausente_levanta_inkstitch_error(self):
        # aponta pra um binário que não existe, sem depender do ambiente real
        import inkstitch_runner as mod
        original = mod.INKSTITCH_BIN
        mod.INKSTITCH_BIN = "/caminho/que/nao/existe/inkstitch"
        try:
            with self.assertRaises(InkstitchError):
                run_inkstitch(SQUARE_SVG, formats=("dst",))
        finally:
            mod.INKSTITCH_BIN = original


@unittest.skipUnless(_HAS_INKSTITCH, "binário do Ink/Stitch só existe no container Docker")
class TestRunInkstitchEndToEnd(unittest.TestCase):
    """Chamam o binário de verdade — só rodam dentro do container."""

    def test_gera_dst_nao_vazio_de_um_quadrado(self):
        result = run_inkstitch(SQUARE_SVG, formats=("dst",))
        self.assertIn("dst", result)
        self.assertGreater(len(result["dst"]), 0)

    def test_dst_gerado_tem_pontos_de_verdade(self):
        import pyembroidery
        import tempfile
        from pathlib import Path

        result = run_inkstitch(SQUARE_SVG, formats=("dst",))
        with tempfile.TemporaryDirectory() as tmp:
            dst_path = Path(tmp) / "out.dst"
            dst_path.write_bytes(result["dst"])
            pattern = pyembroidery.read(str(dst_path))
        self.assertGreater(len(pattern.stitches), 0)

    def test_multiplos_formatos_de_uma_vez(self):
        result = run_inkstitch(SQUARE_SVG, formats=("dst", "pes"))
        self.assertIn("dst", result)
        self.assertIn("pes", result)
        self.assertGreater(len(result["dst"]), 0)
        self.assertGreater(len(result["pes"]), 0)

    def test_svg_sem_paths_ainda_gera_arquivo_valido(self):
        empty_svg = (
            '<svg xmlns="http://www.w3.org/2000/svg" width="10mm" height="10mm" '
            'viewBox="0 0 10 10"></svg>'
        )
        # Não deve travar/estourar timeout mesmo sem nenhum path — o Ink/Stitch
        # pode gerar um DST vazio (0 pontos) ou levantar erro claro; qualquer
        # um dos dois é aceitável, o que NÃO pode é travar.
        try:
            result = run_inkstitch(empty_svg, formats=("dst",))
            self.assertIn("dst", result)
        except InkstitchError:
            pass  # erro claro também é um resultado válido aqui


if __name__ == "__main__":
    unittest.main()
