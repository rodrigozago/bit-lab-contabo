import { createCipheriv, randomBytes } from "crypto";

const NONCE_LEN = 12;

/**
 * AES-256-GCM das credenciais de social_accounts (auth_token/ct0) — mesmo
 * formato de bytes que workers/ingest-social/crypto.py (nonce 12 bytes +
 * ciphertext + tag GCM de 16 bytes, tudo concatenado): quem cifra aqui é a
 * API (rota admin), quem decifra é o worker Python — os dois lados
 * precisam bater o layout. Só cifra, nunca decifra (write-only por design,
 * ver routes/admin.ts).
 */
function getKey(): Buffer {
  const raw = process.env["SOCIAL_ACCOUNTS_ENCRYPTION_KEY"];
  if (!raw) throw new Error("SOCIAL_ACCOUNTS_ENCRYPTION_KEY não definida");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("SOCIAL_ACCOUNTS_ENCRYPTION_KEY precisa decodificar (base64) pra 32 bytes");
  }
  return key;
}

export function encryptSecret(plaintext: string): Buffer {
  const key = getKey();
  const nonce = randomBytes(NONCE_LEN);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([nonce, ciphertext, tag]);
}
