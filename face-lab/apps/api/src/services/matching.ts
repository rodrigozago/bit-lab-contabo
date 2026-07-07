import { pool, toVector } from "../db.js";
import { config } from "../config.js";

// Matches são PRÉ-COMPUTADOS nos dois momentos em que dados chegam:
// foto processada → busca enrollments ativos; enrollment concluído → busca todas
// as faces. Galeria vira JOIN simples; `rematch` recalcula tudo (threshold novo).

/** Casa as faces recém-inseridas de uma foto contra todos os enrollments ativos. */
export async function matchPhotoFaces(photoId: string): Promise<number> {
  const { rowCount } = await pool.query(
    `INSERT INTO matches (face_id, user_id, enrollment_id, distance)
     SELECT f.id, e.user_id, e.id, (f.embedding <=> e.embedding)::real
     FROM faces f
     JOIN enrollments e ON e.active AND e.status = 'done' AND e.embedding IS NOT NULL
     WHERE f.photo_id = $1
       AND (f.embedding <=> e.embedding) <= $2
     ON CONFLICT (face_id, user_id) DO NOTHING`,
    [photoId, config.matchDistanceThreshold]
  );
  return rowCount ?? 0;
}

/** Casa um enrollment recém-concluído contra todas as faces já indexadas. */
export async function matchEnrollment(enrollmentId: string, userId: string, embedding: number[]): Promise<number> {
  const { rowCount } = await pool.query(
    `INSERT INTO matches (face_id, user_id, enrollment_id, distance)
     SELECT f.id, $2, $1, (f.embedding <=> $3::vector)::real
     FROM faces f
     WHERE (f.embedding <=> $3::vector) <= $4
     ON CONFLICT (face_id, user_id) DO NOTHING`,
    [enrollmentId, userId, toVector(embedding), config.matchDistanceThreshold]
  );
  return rowCount ?? 0;
}

/**
 * Recalcula todos os matches automáticos (preserva confirmed/rejected).
 * Usar após mudar MATCH_DISTANCE_THRESHOLD ou pra sanear dados.
 */
export async function rematchAll(): Promise<number> {
  await pool.query(`DELETE FROM matches WHERE status = 'auto'`);
  const { rowCount } = await pool.query(
    `INSERT INTO matches (face_id, user_id, enrollment_id, distance)
     SELECT f.id, e.user_id, e.id, (f.embedding <=> e.embedding)::real
     FROM faces f
     JOIN enrollments e ON e.active AND e.status = 'done' AND e.embedding IS NOT NULL
     WHERE (f.embedding <=> e.embedding) <= $1
     ON CONFLICT (face_id, user_id) DO NOTHING`,
    [config.matchDistanceThreshold]
  );
  return rowCount ?? 0;
}
