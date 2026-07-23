"""Worker de análise — MVP.

Consome `raw_items` não processados (processado=false), chama a OpenAI pra
sentimento + extração de entidades (candidato/partido mencionado) e grava o
embedding do texto — tudo numa única chamada de chat (structured output) +
uma chamada de embeddings **uma vez só por item**, mesmo quando ele vira
menção pra vários tenants (ver fan-out abaixo) — não faz sentido pagar a
OpenAI de novo pra cada tenant. O embedding já fica salvo com índice HNSW
(ver db/schema.sql) pronto pra dedup por similaridade (retweet/republicação)
e busca semântica; a query de dedup em si é fast-follow, não roda ainda.

Duas rotas pra achar o(s) tenant(s) dono(s) de um item, dependendo da fonte
(`sources.tenant_id`):
- **Source de um tenant específico** (ex: X provisionado a partir de um
  target/keyword — ver apps/api/src/services/sources.ts): 1 tenant só.
- **Source compartilhada** (`tenant_id` nulo — pool de notícias curado por
  admin, ver /api/admin/news-sources): fan-out — casa o texto contra os
  targets/keywords de TODOS os tenants com pelo menos 1 cadastro ativo e
  gera uma linha em `mentions` por tenant que bateu. Uma notícia pode virar
  menção pra vários clientes ao mesmo tempo — é esperado.

`target_id`/`keyword_id` são resolvidos por correspondência simples de texto
contra os cadastros do tenant (nome do alvo / termo da keyword aparecendo no
texto) — é o suficiente pro MVP; NER de verdade fica pra quando o volume
justificar.
"""

import json
import os
import time

import psycopg
from openai import OpenAI
from pgvector.psycopg import register_vector

from scrape_log import log_run

DATABASE_URL = os.environ.get("DATABASE_URL", "postgres://sentinela:sentinela@localhost:5432/sentinela")
POLL_INTERVAL_SECONDS = int(os.environ.get("POLL_INTERVAL_SECONDS", "30"))

client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])

SENTIMENT_SCHEMA = {
    "type": "json_schema",
    "json_schema": {
        "name": "analise_mencao",
        "schema": {
            "type": "object",
            "properties": {
                "sentimento": {"type": "string", "enum": ["positivo", "negativo", "neutro"]},
                "score": {"type": "number", "description": "confiança de -1 (muito negativo) a 1 (muito positivo)"},
                "entidades": {"type": "array", "items": {"type": "string"}, "description": "pessoas/partidos citados"},
            },
            "required": ["sentimento", "score", "entidades"],
            "additionalProperties": False,
        },
        "strict": True,
    },
}


def analyze_text(texto: str) -> dict:
    completion = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {
                "role": "system",
                "content": "Você analisa menções políticas em redes sociais/notícias em português. "
                "Classifique o sentimento do texto e liste as entidades políticas citadas (pessoas, partidos).",
            },
            {"role": "user", "content": texto},
        ],
        response_format=SENTIMENT_SCHEMA,
    )
    return json.loads(completion.choices[0].message.content)


def embed_text(texto: str) -> list[float]:
    resp = client.embeddings.create(model="text-embedding-3-small", input=texto)
    return resp.data[0].embedding


def extract_text(raw: dict) -> str:
    return raw.get("texto") or raw.get("titulo") or raw.get("resumo") or ""


def find_target_or_keyword(cur, tenant_id: str, texto: str) -> tuple[str | None, str | None]:
    cur.execute("SELECT id, nome FROM monitoring_targets WHERE tenant_id = %s AND ativo = true", (tenant_id,))
    for target_id, nome in cur.fetchall():
        if nome.lower() in texto.lower():
            return target_id, None
    cur.execute("SELECT id, termo FROM keywords WHERE tenant_id = %s AND ativo = true", (tenant_id,))
    for keyword_id, termo in cur.fetchall():
        if termo.lower() in texto.lower():
            return None, keyword_id
    return None, None


def tenants_with_active_watch(cur) -> list[str]:
    """Tenants que têm pelo menos 1 target ou keyword ativo — só esses
    entram no fan-out de fontes compartilhadas (sem gastar OpenAI/CPU
    checando tenant que não está monitorando nada ainda)."""
    cur.execute(
        """
        SELECT tenant_id FROM monitoring_targets WHERE ativo = true
        UNION
        SELECT tenant_id FROM keywords WHERE ativo = true
        """
    )
    return [row[0] for row in cur.fetchall()]


def insert_mention(
    cur,
    tenant_id: str,
    target_id: str | None,
    keyword_id: str | None,
    raw_id: str,
    texto: str,
    raw: dict,
    analise: dict,
    embedding: list[float],
) -> None:
    cur.execute(
        """
        INSERT INTO mentions
            (tenant_id, target_id, keyword_id, raw_item_id, texto, url, publicado_em,
             sentimento, score, entidades, embedding)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """,
        (
            tenant_id,
            target_id,
            keyword_id,
            raw_id,
            texto,
            raw.get("url"),
            raw.get("publicado_em"),
            analise["sentimento"],
            analise["score"],
            json.dumps(analise["entidades"]),
            embedding,
        ),
    )


def process_item(conn: psycopg.Connection, raw_id: str, source_id: str, raw: dict) -> None:
    with conn.cursor() as cur:
        cur.execute("SELECT tenant_id FROM sources WHERE id = %s", (source_id,))
        row = cur.fetchone()
        source_tenant_id = row[0] if row else None

        texto = extract_text(raw)
        if not texto.strip():
            cur.execute("UPDATE raw_items SET processado = true WHERE id = %s", (raw_id,))
            conn.commit()
            return

        # sentimento/entidades/embedding custam uma chamada à OpenAI — calcula
        # uma vez só, mesmo que o item vire menção pra vários tenants abaixo
        analise = analyze_text(texto)
        embedding = embed_text(texto)

        if source_tenant_id:
            # source de um tenant específico (ex: X provisionado a partir de
            # um target/keyword) — só esse tenant importa
            target_id, keyword_id = find_target_or_keyword(cur, source_tenant_id, texto)
            insert_mention(cur, source_tenant_id, target_id, keyword_id, raw_id, texto, raw, analise, embedding)
        else:
            # fonte compartilhada (pool de notícias) — fan-out pra todo
            # tenant que tem algo ativo pra monitorar
            for tenant_id in tenants_with_active_watch(cur):
                target_id, keyword_id = find_target_or_keyword(cur, tenant_id, texto)
                if target_id is None and keyword_id is None:
                    continue  # não bateu nada pra esse tenant, não gera menção
                insert_mention(cur, tenant_id, target_id, keyword_id, raw_id, texto, raw, analise, embedding)

        cur.execute("UPDATE raw_items SET processado = true WHERE id = %s", (raw_id,))
    conn.commit()


def run_once() -> None:
    with psycopg.connect(DATABASE_URL) as conn:
        register_vector(conn)
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, source_id, conteudo_bruto FROM raw_items WHERE processado = false LIMIT 50"
            )
            pendentes = cur.fetchall()

        processados = 0
        for raw_id, source_id, conteudo in pendentes:
            try:
                process_item(conn, raw_id, source_id, conteudo)
                processados += 1
            except Exception as exc:  # 1 item ruim não deve travar a fila
                print(f"[analysis] falha no item {raw_id}: {exc}")
                log_run(conn, "analysis", "error", source_id=source_id, mensagem=str(exc))

        if processados > 0:
            log_run(conn, "analysis", "ok", itens=processados)


if __name__ == "__main__":
    while True:
        run_once()
        time.sleep(POLL_INTERVAL_SECONDS)
