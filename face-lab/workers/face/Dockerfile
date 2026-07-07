FROM python:3.12-slim

# build-essential/g++: insightface compila extensão Cython no install
# libgl1/libglib2.0-0: runtime do opencv
RUN apt-get update && apt-get install -y --no-install-recommends \
      build-essential g++ libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /worker

COPY requirements.txt .
RUN pip install --no-cache-dir numpy Cython \
    && pip install --no-cache-dir -r requirements.txt

# Baixa os modelos buffalo_l no BUILD (bake na imagem) — sem cold-start
# dependente de internet nem re-download a cada recriação do container
RUN python -c "from insightface.app import FaceAnalysis; FaceAnalysis(name='buffalo_l', providers=['CPUExecutionProvider'])"

COPY worker.py pipeline.py ./

ENV MEDIA_DIR=/media
ENV OMP_NUM_THREADS=2

CMD ["python", "-u", "worker.py"]
