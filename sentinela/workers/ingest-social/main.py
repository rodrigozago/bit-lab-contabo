"""Worker de ingestão de redes sociais — MVP (só X/Twitter, via twscrape).

Carrega o pool de contas X do Postgres (credenciais cifradas — ver
crypto.py/manage_accounts.py), popula o pool do twscrape a cada ciclo e
busca por cada handle/keyword cadastrado em `sources` (tipo='twitter').
Grava em `raw_items`, mesmo formato do worker de notícias.

Sem contas ativas em `social_accounts`, o ciclo é pulado (silenciosamente
até alguém rodar `manage_accounts.py add` — ver README).
"""

import asyncio
import hashlib
import json
import os
import time

import psycopg
from twscrape import API

from crypto import decrypt
from platforms.twitter import fetch_mentions, load_pool
from scrape_log import log_run

DATABASE_URL = os.environ.get("DATABASE_URL", "postgres://sentinela:sentinela@localhost:5432/sentinela")
POLL_INTERVAL_SECONDS = int(os.environ.get("POLL_INTERVAL_SECONDS", "600"))
TWSCRAPE_DB_PATH = os.environ.get("TWSCRAPE_DB_PATH", "/data/accounts.db")
# proxy padrão (Scrapoxy) pras contas que não têm um proxy dedicado — evita
# que todas as contas apareçam saindo do mesmo IP do worker
DEFAULT_PROXY = os.environ.get("SCRAPOXY_PROXY_URL")


def dedup_hash(item: dict) -> str:
    base = (item.get("id") or item.get("url") or "").encode("utf-8")
    return hashlib.sha256(base).hexdigest()


def fetch_active_accounts(conn: psycopg.Connection) -> list[dict]:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT username, auth_token_encrypted, ct0_encrypted, proxy_url
              FROM social_accounts WHERE platform = 'twitter' AND ativo = true
            """
        )
        return [
            {
                "username": username,
                "auth_token": decrypt(bytes(auth_token_enc)),
                "ct0": decrypt(bytes(ct0_enc)),
                "proxy": proxy_url or DEFAULT_PROXY,
            }
            for username, auth_token_enc, ct0_enc, proxy_url in cur.fetchall()
        ]


def fetch_twitter_sources(conn: psycopg.Connection) -> list[tuple[str, str]]:
    with conn.cursor() as cur:
        cur.execute("SELECT id, url_ou_handle FROM sources WHERE tipo = 'twitter' AND ativo = true")
        return cur.fetchall()


async def run_once() -> None:
    with psycopg.connect(DATABASE_URL) as conn:
        accounts = fetch_active_accounts(conn)
        if not accounts:
            msg = "nenhuma conta X ativa em social_accounts — pulando ciclo"
            print(f"[ingest-social] {msg}")
            log_run(conn, "ingest-social", "error", mensagem=msg)
            return

        api = API(TWSCRAPE_DB_PATH)
        await load_pool(api, accounts)

        for source_id, handle in fetch_twitter_sources(conn):
            try:
                items = await fetch_mentions(api, handle)
            except Exception as exc:  # scraper de rede social é frágil por natureza
                print(f"[ingest-social] falha em {handle}: {exc}")
                log_run(conn, "ingest-social", "error", source_id=source_id, mensagem=str(exc))
                continue

            with conn.cursor() as cur:
                for item in items:
                    cur.execute(
                        """
                        INSERT INTO raw_items (source_id, conteudo_bruto, hash_dedup)
                        VALUES (%s, %s, %s)
                        ON CONFLICT (source_id, hash_dedup) DO NOTHING
                        """,
                        (source_id, json.dumps(item), dedup_hash(item)),
                    )
            conn.commit()
            print(f"[ingest-social] {handle}: {len(items)} itens coletados")
            log_run(conn, "ingest-social", "ok", source_id=source_id, itens=len(items))


if __name__ == "__main__":
    while True:
        asyncio.run(run_once())
        time.sleep(POLL_INTERVAL_SECONDS)
