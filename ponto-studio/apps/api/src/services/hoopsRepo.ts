import { pool } from "../db.js";
import type { Hoop } from "@ponto-studio/shared";

interface HoopRow {
  id: string;
  owner_id: string;
  name: string;
  width_mm: number;
  height_mm: number;
  created_at: Date;
}

function rowToHoop(row: HoopRow): Hoop {
  return {
    id: row.id,
    name: row.name,
    widthMm: row.width_mm,
    heightMm: row.height_mm,
    ownerId: row.owner_id,
  };
}

export async function listByOwner(ownerId: string): Promise<Hoop[]> {
  const { rows } = await pool.query<HoopRow>(
    `SELECT * FROM hoops WHERE owner_id = $1 ORDER BY created_at DESC`,
    [ownerId]
  );
  return rows.map(rowToHoop);
}

export async function create(params: {
  ownerId: string;
  name: string;
  widthMm: number;
  heightMm: number;
}): Promise<Hoop> {
  const { rows } = await pool.query<HoopRow>(
    `INSERT INTO hoops (owner_id, name, width_mm, height_mm)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [params.ownerId, params.name, params.widthMm, params.heightMm]
  );
  return rowToHoop(rows[0]!);
}

export async function remove(id: string, ownerId: string): Promise<boolean> {
  const { rowCount } = await pool.query(`DELETE FROM hoops WHERE id = $1 AND owner_id = $2`, [
    id,
    ownerId,
  ]);
  return (rowCount ?? 0) > 0;
}
