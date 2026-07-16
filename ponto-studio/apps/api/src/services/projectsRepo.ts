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

// ── Versionamento (DATA-4) ────────────────────────────────────────────────────

/** Intervalo mínimo entre snapshots automáticos — o autosave roda a cada
 * ~600ms, então sem coalescing cada sessão de edição viraria centenas de
 * versões inúteis. */
const SNAPSHOT_MIN_INTERVAL_MINUTES = 10;
/** Máximo de versões guardadas por projeto (as mais antigas são podadas). */
const MAX_VERSIONS_PER_PROJECT = 30;

export interface ProjectVersionMeta {
  id: string;
  name: string;
  elementCount: number;
  createdAt: string;
}

/**
 * Grava um snapshot do estado ATUAL do projeto (antes de um update/restore),
 * no máximo 1 a cada SNAPSHOT_MIN_INTERVAL_MINUTES (a menos que `force`),
 * e poda o excedente além de MAX_VERSIONS_PER_PROJECT.
 */
async function snapshotIfDue(projectId: string, force = false): Promise<void> {
  await pool.query(
    `INSERT INTO project_versions (project_id, name, canvas_width_mm, canvas_height_mm, elements)
     SELECT p.id, p.name, p.canvas_width_mm, p.canvas_height_mm, p.elements
     FROM projects p
     WHERE p.id = $1
       AND ($2 OR NOT EXISTS (
         SELECT 1 FROM project_versions v
         WHERE v.project_id = $1
           AND v.created_at > now() - ($3 || ' minutes')::interval
       ))`,
    [projectId, force, SNAPSHOT_MIN_INTERVAL_MINUTES]
  );
  await pool.query(
    `DELETE FROM project_versions
     WHERE project_id = $1
       AND id NOT IN (
         SELECT id FROM project_versions
         WHERE project_id = $1
         ORDER BY created_at DESC
         LIMIT $2
       )`,
    [projectId, MAX_VERSIONS_PER_PROJECT]
  );
}

export async function listVersions(projectId: string): Promise<ProjectVersionMeta[]> {
  const { rows } = await pool.query<{
    id: string;
    name: string;
    element_count: number;
    created_at: Date;
  }>(
    `SELECT id, name, jsonb_array_length(elements) AS element_count, created_at
     FROM project_versions
     WHERE project_id = $1
     ORDER BY created_at DESC`,
    [projectId]
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    elementCount: Number(r.element_count),
    createdAt: r.created_at.toISOString(),
  }));
}

export async function restoreVersion(
  projectId: string,
  versionId: string
): Promise<EmbroideryProject | null> {
  // snapshot do estado atual antes de restaurar — restaurar nunca perde nada
  await snapshotIfDue(projectId, true);
  const { rows } = await pool.query<ProjectRow>(
    `UPDATE projects p SET
       name = v.name,
       canvas_width_mm = v.canvas_width_mm,
       canvas_height_mm = v.canvas_height_mm,
       elements = v.elements,
       updated_at = now()
     FROM project_versions v
     WHERE p.id = $1 AND v.id = $2 AND v.project_id = $1
     RETURNING p.*`,
    [projectId, versionId]
  );
  return rows[0] ? rowToProject(rows[0]) : null;
}

export async function update(id: string, patch: UpdateProjectRequest): Promise<EmbroideryProject | null> {
  // DATA-4: guarda o estado que está sendo substituído (com coalescing)
  await snapshotIfDue(id);
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
