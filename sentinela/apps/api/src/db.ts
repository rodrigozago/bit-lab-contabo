import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import { config } from "./config.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// PGHOST/PGUSER/PGPASSWORD/PGDATABASE (compose) têm precedência — o pg lê
// nativamente e a senha não passa por parse de URL. DATABASE_URL é o fallback dev.
export const pool = process.env["PGHOST"]
  ? new pg.Pool()
  : new pg.Pool({ connectionString: config.databaseUrl });

/** Aplica db/schema.sql (idempotente) em todo boot — sem framework de migração por ora. */
export async function migrate(): Promise<void> {
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
