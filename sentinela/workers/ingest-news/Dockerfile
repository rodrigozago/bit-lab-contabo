FROM python:3.12-slim
WORKDIR /app

COPY workers/ingest-news/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY workers/scrape_log.py .
COPY workers/ingest-news/main.py .

CMD ["python", "main.py"]
