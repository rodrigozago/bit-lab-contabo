"""
Face Lab — pipeline de reconhecimento facial (CPU-only).

InsightFace buffalo_l: detecção SCRFD + embeddings ArcFace 512-d, rodando em
onnxruntime CPUExecutionProvider (VPS sem GPU). Modelo carregado UMA vez no boot.

Saídas (relativas a MEDIA_DIR):
    thumbs/<photoId>.webp  — miniatura ~320px da foto (a original NUNCA fica)
    crops/<faceId>.webp    — recorte de cada rosto detectado (bbox + 25% margem)
"""

import os
import uuid
from pathlib import Path

import numpy as np
from PIL import Image, ImageOps

MEDIA_DIR = Path(os.environ.get("MEDIA_DIR", "/media"))
DET_SCORE_MIN = float(os.environ.get("DET_SCORE_MIN", "0.5"))  # descarta detecções fracas
DET_MAX_SIDE = 2560          # downscale pra detecção em fotos gigantes (RAM)
THUMB_SIZE = 320
CROP_SIZE = 160
CROP_MARGIN = 0.25
ENROLL_MIN_FRAMES = 3

_app = None


def get_app():
    """FaceAnalysis singleton — ~600MB carregado, uma vez só."""
    global _app
    if _app is None:
        from insightface.app import FaceAnalysis

        _app = FaceAnalysis(name="buffalo_l", providers=["CPUExecutionProvider"])
        _app.prepare(ctx_id=-1, det_size=(640, 640))
    return _app


def _load_image(path: str) -> Image.Image:
    """Abre com orientação EXIF aplicada (fotos de celular vêm rotacionadas)."""
    img = Image.open(path)
    img = ImageOps.exif_transpose(img)
    return img.convert("RGB")


def _to_bgr(img: Image.Image) -> np.ndarray:
    return np.asarray(img)[:, :, ::-1].copy()  # InsightFace espera BGR


def process_photo(photo_id: str, image_path: str) -> dict:
    """Foto → thumb + faces (bbox, crop, embedding). Não apaga o original (o worker apaga)."""
    img = _load_image(image_path)
    width, height = img.size

    # detecção numa versão reduzida se a foto for gigante; bbox volta pra escala original
    scale = 1.0
    det_img = img
    if max(width, height) > DET_MAX_SIDE:
        scale = DET_MAX_SIDE / max(width, height)
        det_img = img.resize((int(width * scale), int(height * scale)), Image.LANCZOS)

    faces_out = []
    crops_dir = MEDIA_DIR / "crops"
    crops_dir.mkdir(parents=True, exist_ok=True)

    for face in get_app().get(_to_bgr(det_img)):
        score = float(face.det_score)
        if score < DET_SCORE_MIN:
            continue

        x1, y1, x2, y2 = [float(v) / scale for v in face.bbox]
        x1, y1 = max(0.0, x1), max(0.0, y1)
        x2, y2 = min(float(width), x2), min(float(height), y2)
        w, h = x2 - x1, y2 - y1
        if w <= 1 or h <= 1:
            continue

        # recorte com margem, da imagem ORIGINAL (qualidade)
        mx, my = w * CROP_MARGIN, h * CROP_MARGIN
        box = (
            int(max(0, x1 - mx)),
            int(max(0, y1 - my)),
            int(min(width, x2 + mx)),
            int(min(height, y2 + my)),
        )
        crop = img.crop(box)
        crop.thumbnail((CROP_SIZE, CROP_SIZE), Image.LANCZOS)
        face_id = str(uuid.uuid4())
        crop_rel = f"crops/{face_id}.webp"
        crop.save(MEDIA_DIR / crop_rel, "WEBP", quality=80)

        faces_out.append(
            {
                "bbox": {"x": round(x1, 1), "y": round(y1, 1), "w": round(w, 1), "h": round(h, 1)},
                "detScore": round(score, 4),
                "cropPath": crop_rel,
                "embedding": [float(v) for v in face.normed_embedding],
            }
        )

    thumbs_dir = MEDIA_DIR / "thumbs"
    thumbs_dir.mkdir(parents=True, exist_ok=True)
    thumb = img.copy()
    thumb.thumbnail((THUMB_SIZE, THUMB_SIZE), Image.LANCZOS)
    thumb_rel = f"thumbs/{photo_id}.webp"
    thumb.save(MEDIA_DIR / thumb_rel, "WEBP", quality=80)

    return {
        "width": width,
        "height": height,
        "thumbPath": thumb_rel,
        "faces": faces_out,
    }


def enroll(frame_dir: str) -> dict:
    """
    Frames da webcam → embedding de referência (média re-normalizada).
    Regra: exatamente 1 rosto por frame; frames inválidos são descartados com
    feedback; precisa de >= ENROLL_MIN_FRAMES válidos.
    """
    frames = sorted(Path(frame_dir).glob("frame_*.jpg"))
    if not frames:
        raise ValueError("nenhum frame recebido")

    embeddings = []
    problems = []
    for frame in frames:
        try:
            img = _load_image(str(frame))
        except Exception:
            problems.append(f"{frame.name}: arquivo ilegível")
            continue

        faces = [f for f in get_app().get(_to_bgr(img)) if float(f.det_score) >= DET_SCORE_MIN]
        if len(faces) == 0:
            problems.append(f"{frame.name}: nenhum rosto encontrado")
        elif len(faces) > 1:
            problems.append(f"{frame.name}: mais de um rosto no quadro")
        else:
            embeddings.append(np.asarray(faces[0].normed_embedding, dtype=np.float64))

    if len(embeddings) < ENROLL_MIN_FRAMES:
        detail = "; ".join(problems[:4]) if problems else "frames insuficientes"
        raise ValueError(
            f"só {len(embeddings)} frame(s) válidos (mínimo {ENROLL_MIN_FRAMES}) — {detail}. "
            "Fique sozinho no quadro, com boa iluminação, e tente de novo."
        )

    mean = np.mean(np.stack(embeddings), axis=0)
    mean = mean / np.linalg.norm(mean)  # re-normaliza pra distância de cosseno consistente
    return {"embedding": [float(v) for v in mean], "frameCount": len(embeddings)}
