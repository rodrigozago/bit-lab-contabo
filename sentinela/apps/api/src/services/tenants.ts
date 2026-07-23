import { pool } from "../db.js";
import type { TenantRole } from "@sentinela/shared";

export interface TenantMembership {
  id: string;
  nome: string;
  slug: string;
  role: TenantRole;
}

export async function listTenantsForUser(email: string): Promise<TenantMembership[]> {
  const { rows } = await pool.query<TenantMembership>(
    `SELECT t.id, t.nome, t.slug, tu.role
       FROM tenants t
       JOIN tenant_users tu ON tu.tenant_id = t.id
      WHERE tu.user_email = $1
      ORDER BY t.nome`,
    [email]
  );
  return rows;
}

/** true se o e-mail pertence ao tenant (qualquer papel). */
export async function isTenantMember(tenantId: string, email: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    `SELECT 1 FROM tenant_users WHERE tenant_id = $1 AND user_email = $2`,
    [tenantId, email]
  );
  return (rowCount ?? 0) > 0;
}
