import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { config } from "../config.js";

// AES-256-GCM pro refresh token do Google: bytea = iv(12) || tag(16) || ciphertext
function key(): Buffer {
  const hex = config.google.tokenEncKeyHex;
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error("GOOGLE_TOKEN_ENC_KEY inválida — precisa ser 32 bytes em hex (openssl rand -hex 32)");
  }
  return Buffer.from(hex, "hex");
}

export function encrypt(plaintext: string): Buffer {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf-8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), enc]);
}

export function decrypt(blob: Buffer): string {
  const iv = blob.subarray(0, 12);
  const tag = blob.subarray(12, 28);
  const enc = blob.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf-8");
}
