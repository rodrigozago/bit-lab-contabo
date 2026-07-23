import { pool } from "../db.js";

/**
 * Mantém `sources` (o que os workers de ingestão realmente consultam)
 * sincronizada com o que o tenant cadastra em targets/keywords — sem isso,
 * cadastrar um alvo/palavra-chave no dashboard não gera scraping nenhum.
 * Upsert idempotente via índice único parcial (ver db/schema.sql).
 */
export async function syncTwitterSource(
  tenantId: string,
  urlOuHandle: string,
  ativo: boolean
): Promise<void> {
  await pool.query(
    `INSERT INTO sources (tenant_id, tipo, url_ou_handle, ativo)
     VALUES ($1, 'twitter', $2, $3)
     ON CONFLICT (tenant_id, tipo, url_ou_handle) WHERE tenant_id IS NOT NULL
     DO UPDATE SET ativo = EXCLUDED.ativo`,
    [tenantId, urlOuHandle, ativo]
  );
}

/** Desativa a source de X ligada a um handle/termo que não existe mais. */
export async function deactivateTwitterSource(tenantId: string, urlOuHandle: string): Promise<void> {
  await pool.query(
    `UPDATE sources SET ativo = false WHERE tenant_id = $1 AND tipo = 'twitter' AND url_ou_handle = $2`,
    [tenantId, urlOuHandle]
  );
}
