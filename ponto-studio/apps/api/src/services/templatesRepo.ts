import { pool } from "../db.js";
import type { CanvasSize, DesignTemplate, EmbroideryElement } from "@ponto-studio/shared";

interface TemplateRow {
  id: string;
  created_by: string;
  name: string;
  canvas_width_mm: number;
  canvas_height_mm: number;
  elements: DesignTemplate["elements"];
  created_at: Date;
}

function rowToTemplate(row: TemplateRow): DesignTemplate {
  return {
    id: row.id,
    name: row.name,
    canvas: { widthMm: row.canvas_width_mm, heightMm: row.canvas_height_mm },
    elements: row.elements,
    createdBy: row.created_by,
    createdAt: row.created_at.toISOString(),
  };
}

/** Catálogo inteiro — SEM filtro de dono, é o ponto central da feature (visível pra todo mundo logado). */
export async function listAll(): Promise<DesignTemplate[]> {
  const { rows } = await pool.query<TemplateRow>(
    `SELECT * FROM design_templates ORDER BY created_at DESC`
  );
  return rows.map(rowToTemplate);
}

export async function publishFromProject(params: {
  createdBy: string;
  name: string;
  canvas: CanvasSize;
  elements: EmbroideryElement[];
}): Promise<DesignTemplate> {
  const { rows } = await pool.query<TemplateRow>(
    `INSERT INTO design_templates (created_by, name, canvas_width_mm, canvas_height_mm, elements)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      params.createdBy,
      params.name,
      params.canvas.widthMm,
      params.canvas.heightMm,
      JSON.stringify(params.elements),
    ]
  );
  return rowToTemplate(rows[0]!);
}

/** Sem `owner_id` no WHERE — a autorização já foi feita pelo `requireAdmin`;
 * qualquer admin remove qualquer matriz do catálogo global, não só a que ele
 * mesmo publicou (gestão coletiva do catálogo, não por-autor). */
export async function remove(id: string): Promise<boolean> {
  const { rowCount } = await pool.query(`DELETE FROM design_templates WHERE id = $1`, [id]);
  return (rowCount ?? 0) > 0;
}
