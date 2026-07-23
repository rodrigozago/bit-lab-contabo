"""Scraper de X/Twitter via twscrape.

A X exige login pra busca/timeline (scraping anônimo não é confiável desde
2024) — este módulo fala com o GraphQL interno da X através de um pool de
contas autenticadas, uma sessão por conta (cookies `auth_token`/`ct0`), com
rotação automática entre elas quando uma bate rate-limit. As contas vêm
cifradas do Postgres (tabela `social_accounts` — ver crypto.py e
manage_accounts.py) e são carregadas no pool a cada boot do worker.
"""

from twscrape import API


async def load_pool(api: API, accounts: list[dict]) -> None:
    for acc in accounts:
        cookies = f"auth_token={acc['auth_token']}; ct0={acc['ct0']}"
        # cookies com ct0 ativam a conta na hora, sem passar pelo fluxo de
        # login/senha (que exigiria e-mail pra resolver desafio de 2FA)
        await api.pool.add_account(
            acc["username"], "", "", "", cookies=cookies, proxy=acc.get("proxy")
        )


async def fetch_mentions(api: API, query: str, max_items: int = 20) -> list[dict]:
    items: list[dict] = []
    async for tweet in api.search(query, limit=max_items):
        items.append(
            {
                "id": str(tweet.id),
                "texto": tweet.rawContent,
                "url": tweet.url,
                "publicado_em": tweet.date.isoformat() if tweet.date else None,
            }
        )
    return items
