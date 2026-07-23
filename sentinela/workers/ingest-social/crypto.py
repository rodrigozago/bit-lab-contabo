"""Criptografia das credenciais do pool de contas X (social_accounts).

Hash NÃO serve aqui: hash é de mão única, feito pra *verificar* uma senha,
não pra recuperar o valor original. As contas do twscrape precisam do
auth_token/ct0 originais em texto pra autenticar contra a X — então o
requisito é criptografia reversível, não hash.

AES-256-GCM (autenticado — detecta se o ciphertext foi adulterado) com a
chave vindo só de env var (SOCIAL_ACCOUNTS_ENCRYPTION_KEY), nunca do banco:
se o Postgres vazar sozinho, os cookies continuam ilegíveis sem a chave.

Formato armazenado: nonce (12 bytes) + ciphertext (com tag GCM anexada).
"""

import base64
import os

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

_NONCE_LEN = 12


def _get_key() -> bytes:
    raw = os.environ["SOCIAL_ACCOUNTS_ENCRYPTION_KEY"]
    key = base64.b64decode(raw)
    if len(key) != 32:
        raise ValueError(
            "SOCIAL_ACCOUNTS_ENCRYPTION_KEY precisa decodificar (base64) pra 32 bytes — "
            "gere com: openssl rand -base64 32"
        )
    return key


def encrypt(plaintext: str) -> bytes:
    key = _get_key()
    nonce = os.urandom(_NONCE_LEN)
    ciphertext = AESGCM(key).encrypt(nonce, plaintext.encode("utf-8"), None)
    return nonce + ciphertext


def decrypt(blob: bytes) -> str:
    key = _get_key()
    nonce, ciphertext = blob[:_NONCE_LEN], blob[_NONCE_LEN:]
    plaintext = AESGCM(key).decrypt(nonce, ciphertext, None)
    return plaintext.decode("utf-8")
