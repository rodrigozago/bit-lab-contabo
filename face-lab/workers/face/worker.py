"""
Face Lab — Face Worker
======================
Lê jobs da fila Redis (LIST "facelab:jobs") e publica resultados no canal
"facelab:results" — mesmo desenho do worker do ponto-studio.

Jobs:
    { "type": "process_photo", "photoId", "imagePath", "watermark" }
        → { "type": "photo_faces", "photoId", "status", width, height,
            thumbPath, faces: [{bbox, detScore, cropPath, embedding[512]}] }
    { "type": "enroll", "enrollmentId", "frameDir" }
        → { "type": "enrollment", "enrollmentId", "status", embedding, frameCount }
    { "type": "regen_thumb", "photoId", "imagePath", "watermark" }
        → { "type": "thumb_regenerated", "photoId", "status", thumbPath }
          (não roda detecção — só rebate a miniatura, ex: toggle de marca d'água)

Originais de /media/incoming são APAGADOS no finally — nunca persistem.
"""

import json
import logging
import os
import sys
import time
from pathlib import Path
from typing import Any

import redis

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [worker] %(levelname)s %(message)s",
    stream=sys.stdout,
)
log = logging.getLogger("face-worker")

REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379")
JOBS_QUEUE = "facelab:jobs"
RESULTS_CHANNEL = "facelab:results"


def process_photo_job(r: redis.Redis, job: dict[str, Any]) -> None:
    from pipeline import process_photo

    photo_id: str = job["photoId"]
    image_path: str = job["imagePath"]
    watermark: bool = bool(job.get("watermark", False))
    log.info("Processando foto %s (%s)", photo_id, image_path)

    try:
        if not Path(image_path).exists():
            raise FileNotFoundError(f"imagem não encontrada: {image_path}")
        started = time.monotonic()
        result = process_photo(photo_id, image_path, watermark=watermark)
        log.info(
            "Foto %s: %d rosto(s) em %.1fs",
            photo_id, len(result["faces"]), time.monotonic() - started,
        )
        r.publish(
            RESULTS_CHANNEL,
            json.dumps({"type": "photo_faces", "photoId": photo_id, "status": "done", **result}),
        )
    except Exception as exc:
        log.exception("Foto %s falhou", photo_id)
        r.publish(
            RESULTS_CHANNEL,
            json.dumps({"type": "photo_faces", "photoId": photo_id, "status": "error", "error": str(exc)}),
        )
    finally:
        # original nunca persiste — só thumb/crops/embeddings ficam
        try:
            Path(image_path).unlink(missing_ok=True)
        except OSError:
            log.warning("não consegui apagar %s", image_path)


def enroll_job(r: redis.Redis, job: dict[str, Any]) -> None:
    from pipeline import enroll

    enrollment_id: str = job["enrollmentId"]
    frame_dir: str = job["frameDir"]
    log.info("Processando enrollment %s (%s)", enrollment_id, frame_dir)

    try:
        result = enroll(frame_dir)
        log.info("Enrollment %s ok (%d frames)", enrollment_id, result["frameCount"])
        r.publish(
            RESULTS_CHANNEL,
            json.dumps({"type": "enrollment", "enrollmentId": enrollment_id, "status": "done", **result}),
        )
    except Exception as exc:
        log.exception("Enrollment %s falhou", enrollment_id)
        r.publish(
            RESULTS_CHANNEL,
            json.dumps({"type": "enrollment", "enrollmentId": enrollment_id, "status": "error", "error": str(exc)}),
        )
    # os frames são apagados pela API ao receber o resultado (dado biométrico temporário)


def regen_thumb_job(r: redis.Redis, job: dict[str, Any]) -> None:
    from pipeline import regenerate_thumb

    photo_id: str = job["photoId"]
    image_path: str = job["imagePath"]
    watermark: bool = bool(job.get("watermark", False))
    variant: str | None = job.get("variant")
    log.info("Rebatendo miniatura %s (watermark=%s, variant=%s)", photo_id, watermark, variant)

    try:
        if not Path(image_path).exists():
            raise FileNotFoundError(f"imagem não encontrada: {image_path}")
        result = regenerate_thumb(photo_id, image_path, watermark, variant=variant)
        r.publish(
            RESULTS_CHANNEL,
            json.dumps({"type": "thumb_regenerated", "photoId": photo_id, "status": "done", **result}),
        )
    except Exception as exc:
        log.exception("Regen de miniatura %s falhou", photo_id)
        r.publish(
            RESULTS_CHANNEL,
            json.dumps({"type": "thumb_regenerated", "photoId": photo_id, "status": "error", "error": str(exc)}),
        )
    finally:
        try:
            Path(image_path).unlink(missing_ok=True)
        except OSError:
            log.warning("não consegui apagar %s", image_path)


def process_job(r: redis.Redis, job: dict[str, Any]) -> None:
    job_type = job.get("type")
    if job_type == "process_photo":
        process_photo_job(r, job)
    elif job_type == "enroll":
        enroll_job(r, job)
    elif job_type == "regen_thumb":
        regen_thumb_job(r, job)
    else:
        log.error("Tipo de job desconhecido: %s", job_type)


def main() -> None:
    log.info("Face worker iniciando. Redis: %s", REDIS_URL)

    # carrega os modelos ANTES de aceitar jobs (falha rápido se algo estiver errado)
    from pipeline import get_app

    get_app()
    log.info("Modelos InsightFace (buffalo_l, CPU) carregados.")

    BLPOP_TIMEOUT = 10
    r = redis.from_url(
        REDIS_URL,
        decode_responses=True,
        socket_timeout=BLPOP_TIMEOUT + 5,
        socket_connect_timeout=5,
    )

    for attempt in range(10):
        try:
            r.ping()
            log.info("Redis conectado.")
            break
        except (redis.exceptions.ConnectionError, redis.exceptions.TimeoutError):
            log.warning("Redis indisponível, tentativa %d/10…", attempt + 1)
            time.sleep(2)
    else:
        log.error("Não foi possível conectar ao Redis. Encerrando.")
        sys.exit(1)

    log.info("Aguardando jobs na fila '%s'…", JOBS_QUEUE)

    while True:
        try:
            item = r.blpop(JOBS_QUEUE, timeout=BLPOP_TIMEOUT)
            if item is None:
                continue
            _, payload = item
            process_job(r, json.loads(payload))
        except redis.exceptions.ConnectionError as exc:
            log.error("Conexão Redis perdida: %s — reconectando em 3s…", exc)
            time.sleep(3)
        except redis.exceptions.TimeoutError:
            continue  # BLPOP sem itens — normal
        except json.JSONDecodeError as exc:
            log.error("Payload inválido: %s", exc)
        except KeyboardInterrupt:
            log.info("Worker encerrado.")
            break
        except Exception as exc:
            log.exception("Erro inesperado no loop principal: %s", exc)
            time.sleep(1)


if __name__ == "__main__":
    main()
