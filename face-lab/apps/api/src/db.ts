import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import { config } from "./config.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const pool = new pg.Pool({ connectionString: config.databaseUrl });

/** Aplica db/schema.sql (idempotente) em todo boot — sem framework de migração por ora. */
export async function migrate(): Promise<void> {
  // dist/db.js → ../../db/schema.sql dentro do container (copiado pelo Dockerfile);
  // em dev (tsx), src/db.ts → ../../../db/schema.sql na raiz do workspace
  const candidates = [
    join(__dirname, "..", "db", "schema.sql"),
    join(__dirname, "..", "..", "..", "db", "schema.sql"),
  ];
  let sql: string | null = null;
  for (const p of candidates) {
    try {
      sql = readFileSync(p, "utf-8");
      break;
    } catch {
      // tenta o próximo caminho
    }
  }
  if (!sql) throw new Error(`db/schema.sql não encontrado (tentado: ${candidates.join(", ")})`);
  await pool.query(sql);
  console.log("[db] schema aplicado");
}

/** Literal pgvector: [0.1,0.2,...] — usar com cast $1::vector */
export function toVector(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}
