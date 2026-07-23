"""Worker de ingestão de notícias — MVP.

Lê feeds RSS cadastrados em `sources` (tipo='news'), extrai os artigos com
feedparser (rápido, cobre a maioria dos veículos que publicam RSS) e grava
em `raw_items` pra o worker de análise processar depois. Sites sem RSS ficam
pra uma iteração seguinte com Crawl4AI (extração por scraping direto).

Roda em loop simples com intervalo fixo — sem scheduler dedicado ainda
(cron/APScheduler é fast-follow quando o volume de fontes crescer).
"""

import hashlib
import json
import os
import time

import feedparser
import psycopg

from scrape_log import log_run

DATABASE_URL = os.environ.get("DATABASE_URL", "postgres://sentinela:sentinela@localhost:5432/sentinela")
POLL_INTERVAL_SECONDS = int(os.environ.get("POLL_INTERVAL_SECONDS", "300"))


def dedup_hash(entry: dict) -> str:
    base = (entry.get("id") or entry.get("link") or entry.get("title") or "").encode("utf-8")
    return hashlib.sha256(base).hexdigest()


def fetch_news_sources(conn: psycopg.Connection) -> list[tuple[str, str]]:
    with conn.cursor() as cur:
        cur.execute("SELECT id, url_ou_handle FROM sources WHERE tipo = 'news' AND ativo = true")
        return cur.fetchall()


def ingest_feed(conn: psycopg.Connection, source_id: str, feed_url: str) -> int:
    parsed = feedparser.parse(feed_url)
    inserted = 0
    with conn.cursor() as cur:
        for entry in parsed.entries:
            payload = {
                "titulo": entry.get("title"),
                "url": entry.get("link"),
                "resumo": entry.get("summary"),
                "publicado_em": entry.get("published"),
            }
            cur.execute(
                """
                INSERT INTO raw_items (source_id, conteudo_bruto, hash_dedup)
                VALUES (%s, %s, %s)
                ON CONFLICT (source_id, hash_dedup) DO NOTHING
                """,
                (source_id, json.dumps(payload), dedup_hash(entry)),
            )
            inserted += cur.rowcount
    conn.commit()
    return inserted


def run_once() -> None:
    with psycopg.connect(DATABASE_URL) as conn:
        sources = fetch_news_sources(conn)
        for source_id, feed_url in sources:
            try:
                n = ingest_feed(conn, source_id, feed_url)
                print(f"[ingest-news] {feed_url}: {n} itens novos")
                log_run(conn, "ingest-news", "ok", source_id=source_id, itens=n)
            except Exception as exc:  # feed instável não deve derrubar o worker
                print(f"[ingest-news] falha em {feed_url}: {exc}")
                log_run(conn, "ingest-news", "error", source_id=source_id, mensagem=str(exc))


if __name__ == "__main__":
    while True:
        run_once()
        time.sleep(POLL_INTERVAL_SECONDS)
