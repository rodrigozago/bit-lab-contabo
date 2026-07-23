"""Grava uma linha em `scrape_runs` — alimenta o dashboard de scraping
(status por fonte + log de erros) que a API expõe em /api/admin/scrape-runs.

Cada worker copia este arquivo pro seu próprio contexto de build (ver
Dockerfiles) já que os workers não compartilham um pacote Python instalável
entre si — mesmo espírito do packages/shared do lado TypeScript, só que sem
o empacotamento formal (não vale a complexidade pra um arquivo só).
"""

import psycopg


def log_run(
    conn: psycopg.Connection,
    worker: str,
    status: str,
    source_id: str | None = None,
    mensagem: str | None = None,
    itens: int = 0,
) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO scrape_runs (worker, source_id, status, mensagem, itens)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (worker, source_id, status, mensagem, itens),
        )
    conn.commit()
