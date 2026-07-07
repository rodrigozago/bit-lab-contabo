FROM python:3.12-slim

WORKDIR /worker

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY worker.py analyze.py test_analyze.py test_fill.py ./

ENV EXPORTS_DIR=/exports
ENV UPLOADS_DIR=/uploads
ENV REDIS_URL=redis://redis:6379

CMD ["python3", "-u", "worker.py"]
