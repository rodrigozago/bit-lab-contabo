import { pool } from "../db.js";
import type { CanvasSize, EmbroideryProject, UpdateProjectRequest } from "@ponto-studio/shared";

interface ProjectRow {
  id: string;
  owner_id: string;
  name: string;
  canvas_width_mm: number;
  canvas_height_mm: number;
  elements: EmbroideryProject["elements"];
  created_at: Date;
  updated_at: Date;
}

function rowToProject(row: ProjectRow): EmbroideryProject {
  return {
    id: row.id,
    name: row.name,
    canvas: { widthMm: row.canvas_width_mm, heightMm: row.canvas_height_mm },
    elements: row.elements,
    ownerId: row.owner_id,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function listByOwner(ownerId: string): Promise<EmbroideryProject[]> {
  const { rows } = await pool.query<ProjectRow>(
    `SELECT * FROM projects WHERE owner_id = $1 ORDER BY updated_at DESC`,
    [ownerId]
  );
  return rows.map(rowToProject);
}

export async function get(id: string): Promise<EmbroideryProject | null> {
  const { rows } = await pool.query<ProjectRow>(`SELECT * FROM projects WHERE id = $1`, [id]);
  return rows[0] ? rowToProject(rows[0]) : null;
}

export async function create(params: {
  id: string;
  ownerId: string;
  name: string;
  canvas: CanvasSize;
}): Promise<EmbroideryProject> {
  const { rows } = await pool.query<ProjectRow>(
    `INSERT INTO projects (id, owner_id, name, canvas_width_mm, canvas_height_mm, elements)
     VALUES ($1, $2, $3, $4, $5, '[]'::jsonb)
     RETURNING *`,
    [params.id, params.ownerId, params.name, params.canvas.widthMm, params.canvas.heightMm]
  );
  return rowToProject(rows[0]!);
}

export async function update(id: string, patch: UpdateProjectRequest): Promise<EmbroideryProject | null> {
  const { rows } = await pool.query<ProjectRow>(
    `UPDATE projects SET
       name = COALESCE($2, name),
       canvas_width_mm = COALESCE($3, canvas_width_mm),
       canvas_height_mm = COALESCE($4, canvas_height_mm),
       elements = COALESCE($5, elements),
       updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [
      id,
      patch.name ?? null,
      patch.canvas?.widthMm ?? null,
      patch.canvas?.heightMm ?? null,
      patch.elements ? JSON.stringify(patch.elements) : null,
    ]
  );
  return rows[0] ? rowToProject(rows[0]) : null;
}

export async function remove(id: string): Promise<boolean> {
  const { rowCount } = await pool.query(`DELETE FROM projects WHERE id = $1`, [id]);
  return (rowCount ?? 0) > 0;
}
