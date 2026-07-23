"""Worker de análise — MVP.

Consome `raw_items` não processados (processado=false), chama a OpenAI pra
sentimento + extração de entidades (candidato/partido mencionado) e grava o
embedding do texto junto com a menção — tudo numa única chamada de chat
(structured output) + uma chamada de embeddings, pra manter simples. O
embedding já fica salvo com índice HNSW (ver db/schema.sql) pronto pra dedup
por similaridade (retweet/republicação) e busca semântica; a query de dedup
em si é fast-follow, não roda ainda neste MVP.

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


def process_item(conn: psycopg.Connection, raw_id: str, source_id: str, raw: dict) -> None:
    with conn.cursor() as cur:
        # tenant do item vem da fonte — fonte compartilhada (tenant_id nulo)
        # não gera menção por tenant específico ainda (fast-follow: replicar
        # por todos os tenants que têm keyword/target batendo)
        cur.execute("SELECT tenant_id FROM sources WHERE id = %s", (source_id,))
        row = cur.fetchone()
        tenant_id = row[0] if row else None
        if not tenant_id:
            cur.execute("UPDATE raw_items SET processado = true WHERE id = %s", (raw_id,))
            return

        texto = extract_text(raw)
        if not texto.strip():
            cur.execute("UPDATE raw_items SET processado = true WHERE id = %s", (raw_id,))
            return

        analise = analyze_text(texto)
        embedding = embed_text(texto)
        target_id, keyword_id = find_target_or_keyword(cur, tenant_id, texto)

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
