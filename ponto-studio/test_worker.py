import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

import pyembroidery

# Importa o worker para ter acesso às suas funções
import worker


class TestEmbroideryWorker(unittest.TestCase):
    def setUp(self):
        # Cria um diretório temporário para os exports
        self.tmpdir = tempfile.TemporaryDirectory()
        self.exports_dir = Path(self.tmpdir.name)
        worker.EXPORTS_DIR = self.exports_dir

    def tearDown(self):
        # Limpa o diretório temporário
        self.tmpdir.cleanup()

    def test_hex_to_rgb(self):
        """Testa a conversão de cores hex para RGB."""
        self.assertEqual(worker.hex_to_rgb("#FF0000"), (255, 0, 0))
        self.assertEqual(worker.hex_to_rgb("#00ff00"), (0, 255, 0))
        self.assertEqual(worker.hex_to_rgb("#123"), (17, 34, 51))
        self.assertEqual(worker.hex_to_rgb("ABC"), (170, 187, 204))

    def test_svg_to_embroidery_with_sample(self):
        """Testa a conversão de um SVG anotado para um padrão de bordado."""
        # Usa o sample.svg real para um teste de integração
        sample_svg_path = Path(__file__).parent / "sample.svg"
        self.assertTrue(sample_svg_path.exists(), "O arquivo sample.svg deve existir")

        pattern = worker.svg_to_embroidery(sample_svg_path, "dst")

        # Verifica se o padrão foi criado
        self.assertIsNotNone(pattern)
        self.assertIsInstance(pattern, pyembroidery.EmbPattern)

        # Verifica se há pontos gerados (deve haver muitos para o preenchimento)
        self.assertGreater(len(pattern.stitches), 100)

        # Verifica se as cores foram adicionadas corretamente
        self.assertEqual(len(pattern.threadlist), 2)
        self.assertEqual(pattern.threadlist[0].hex_color(), "E64980") # Cor do fill
        self.assertEqual(pattern.threadlist[1].hex_color(), "495057") # Cor do stroke

    def test_svg_to_embroidery_empty_svg(self):
        """Testa o comportamento com um SVG vazio."""
        svg_path = self.exports_dir / "empty.svg"
        svg_path.write_text("<svg></svg>")

        pattern = worker.svg_to_embroidery(svg_path, "dst")
        # Deve retornar um padrão vazio com apenas o comando END
        self.assertEqual(len(pattern.stitches), 1)
        self.assertEqual(pattern.stitches[0][2], pyembroidery.END)

    def test_process_job_success(self):
        """Testa o fluxo completo de um job com sucesso."""
        mock_redis = MagicMock()
        
        # Cria um SVG de teste no diretório de exports
        svg_file = "test.svg"
        svg_content = (Path(__file__).parent / "sample.svg").read_text()
        (self.exports_dir / svg_file).write_text(svg_content)

        job_data = {
            "jobId": "job-123",
            "svgFile": svg_file,
            "format": "DST"
        }

        worker.process_job(mock_redis, job_data)

        # Verifica se o arquivo de saída foi criado
        output_file = self.exports_dir / "job-123.dst"
        self.assertTrue(output_file.exists())
        self.assertGreater(output_file.stat().st_size, 0)

        # Verifica se o resultado de sucesso foi publicado no Redis
        mock_redis.publish.assert_called_once()
        channel, message = mock_redis.publish.call_args[0]
        self.assertEqual(channel, worker.RESULTS_CHANNEL)
        result = json.loads(message)
        self.assertEqual(result["status"], "done")
        self.assertEqual(result["jobId"], "job-123")
        self.assertEqual(result["outputFile"], "job-123.dst")

    def test_process_job_svg_not_found(self):
        """Testa o erro quando o arquivo SVG não é encontrado."""
        mock_redis = MagicMock()
        job_data = {"jobId": "job-404", "svgFile": "nonexistent.svg", "format": "PES"}

        worker.process_job(mock_redis, job_data)

        # Verifica se uma mensagem de erro foi publicada
        mock_redis.publish.assert_called_once()
        _, message = mock_redis.publish.call_args[0]
        result = json.loads(message)
        self.assertEqual(result["status"], "error")
        self.assertEqual(result["jobId"], "job-404")
        self.assertIn("SVG não encontrado", result["error"])


if __name__ == "__main__":
    unittest.main()