FROM python:3.12-slim
WORKDIR /app

COPY workers/ingest-social/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY workers/scrape_log.py .
COPY workers/ingest-social/ .

CMD ["python", "main.py"]
