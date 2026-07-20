FROM python:3.12-slim

WORKDIR /worker

# Ink/Stitch: motor real de digitalização de bordado (GPLv3). Rodamos o
# binário standalone dele via subprocess (inkstitch_runner.py) — NÃO
# importamos os módulos Python dele no nosso processo, então nosso worker
# continua com licença própria (é "mera agregação": processo separado,
# comunicação só por arquivo/stdin-stdout). O binário já traz Python + GTK +
# wxPython + a maioria das libs X11 embutidas (build PyInstaller); só falta
# libgl1 (não bundlado) e o Xvfb (framebuffer virtual — o binário toca X
# mesmo em modo CLI headless).
ARG INKSTITCH_VERSION=3.2.2
RUN apt-get update && apt-get install -y --no-install-recommends \
        curl xz-utils xvfb xauth libgl1 fonts-dejavu-core \
        libwayland-client0 libwayland-cursor0 libwayland-egl1 \
    && curl -sL -o /tmp/inkstitch.tar.xz \
        "https://github.com/inkstitch/inkstitch/releases/download/v${INKSTITCH_VERSION}/inkstitch-${INKSTITCH_VERSION}-linux-x86_64.tar.xz" \
    && mkdir -p /opt/inkstitch \
    && tar -xJf /tmp/inkstitch.tar.xz -C /opt/inkstitch --strip-components=1 \
    && rm /tmp/inkstitch.tar.xz \
    && chmod +x /opt/inkstitch/bin/inkstitch \
    && apt-get purge -y curl xz-utils && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/*

ENV INKSTITCH_BIN=/opt/inkstitch/bin/inkstitch

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY worker.py analyze.py inkstitch_runner.py test_analyze.py test_worker.py test_inkstitch_runner.py ./

ENV EXPORTS_DIR=/exports
ENV UPLOADS_DIR=/uploads
ENV REDIS_URL=redis://redis:6379

CMD ["python3", "-u", "worker.py"]
