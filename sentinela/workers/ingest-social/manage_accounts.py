"""CLI pra gerenciar o pool de contas X do worker de ingestão social.

Extração de auth_token/ct0: logue no X num navegador comum (conta dedicada
pra isso, nunca uma conta pessoal) → DevTools → Application → Cookies →
copie os valores de `auth_token` e `ct0`.

Uso:
    python manage_accounts.py add --username fulano --auth-token XXX --ct0 YYY [--proxy http://user:pass@host:porta]
    python manage_accounts.py list
    python manage_accounts.py disable <id>

Roda dentro do container do worker (tem as libs certas) ou localmente com
DATABASE_URL e SOCIAL_ACCOUNTS_ENCRYPTION_KEY apontando pro ambiente certo:
    docker compose exec worker-ingest-social python manage_accounts.py add ...
"""

import argparse
import os

import psycopg

from crypto import encrypt

DATABASE_URL = os.environ.get("DATABASE_URL", "postgres://sentinela:sentinela@localhost:5432/sentinela")


def add_account(username: str, auth_token: str, ct0: str, proxy: str | None) -> None:
    with psycopg.connect(DATABASE_URL) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO social_accounts (platform, username, auth_token_encrypted, ct0_encrypted, proxy_url)
                VALUES ('twitter', %s, %s, %s, %s)
                """,
                (username, encrypt(auth_token), encrypt(ct0), proxy),
            )
        conn.commit()
    print(f"conta @{username} adicionada")


def list_accounts() -> None:
    with psycopg.connect(DATABASE_URL) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, username, ativo, proxy_url, criado_em FROM social_accounts ORDER BY criado_em"
            )
            for account_id, username, ativo, proxy_url, criado_em in cur.fetchall():
                status = "ativa" if ativo else "desativada"
                print(f"{account_id}  @{username:<20} {status:<11} proxy={proxy_url or '-'}  {criado_em}")


def disable_account(account_id: str) -> None:
    with psycopg.connect(DATABASE_URL) as conn:
        with conn.cursor() as cur:
            cur.execute("UPDATE social_accounts SET ativo = false WHERE id = %s", (account_id,))
        conn.commit()
    print(f"conta {account_id} desativada")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_add = sub.add_parser("add")
    p_add.add_argument("--username", required=True)
    p_add.add_argument("--auth-token", required=True)
    p_add.add_argument("--ct0", required=True)
    p_add.add_argument("--proxy")

    sub.add_parser("list")

    p_disable = sub.add_parser("disable")
    p_disable.add_argument("account_id")

    args = parser.parse_args()
    if args.cmd == "add":
        add_account(args.username, args.auth_token, args.ct0, args.proxy)
    elif args.cmd == "list":
        list_accounts()
    elif args.cmd == "disable":
        disable_account(args.account_id)
