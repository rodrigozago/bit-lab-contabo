import { pool, toVector } from "../db.js";
import { config } from "../config.js";

// Matches são PRÉ-COMPUTADOS nos momentos em que dados chegam (foto processada,
// enrollment concluído, "sou eu" confirmado). Galeria vira JOIN simples.
//
// Conjunto de REFERÊNCIAS de cada usuário = enrollment ativo + até 10 faces
// que ele confirmou com "sou eu" (o "treino": cada confirmação vira um probe a
// mais). Sempre respeita rejected_people ("não sou eu" por pessoa).

const REFS_CTE = `
  refs AS (
    SELECT e.user_id, e.id AS enrollment_id, e.embedding
    FROM enrollments e
    WHERE e.active AND e.status = 'done' AND e.embedding IS NOT NULL
    UNION ALL
    SELECT u.id AS user_id, NULL::uuid AS enrollment_id, cf.embedding
    FROM users u
    CROSS JOIN LATERAL (
      SELECT f.embedding
      FROM matches m JOIN faces f ON f.id = m.face_id
      WHERE m.user_id = u.id AND m.status = 'confirmed'
      ORDER BY m.created_at DESC
      LIMIT 10
    ) cf
  )`;

const NOT_REJECTED = `NOT EXISTS (
  SELECT 1 FROM rejected_people rp WHERE rp.user_id = r.user_id AND rp.person_id = f.person_id
)`;

/** Casa as faces recém-inseridas de uma foto contra as referências de todos os usuários. */
export async function matchPhotoFaces(photoId: string): Promise<number> {
  const { rowCount } = await pool.query(
    `WITH ${REFS_CTE}
     INSERT INTO matches (face_id, user_id, enrollment_id, distance)
     SELECT DISTINCT ON (f.id, r.user_id)
            f.id, r.user_id, r.enrollment_id, (f.embedding <=> r.embedding)::real AS d
     FROM faces f
     JOIN refs r ON (f.embedding <=> r.embedding) <= $2
     WHERE f.photo_id = $1 AND ${NOT_REJECTED}
     ORDER BY f.id, r.user_id, d
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
       AND NOT EXISTS (
         SELECT 1 FROM rejected_people rp WHERE rp.user_id = $2 AND rp.person_id = f.person_id
       )
     ON CONFLICT (face_id, user_id) DO NOTHING`,
    [enrollmentId, userId, toVector(embedding), config.matchDistanceThreshold]
  );
  return rowCount ?? 0;
}

/**
 * Expande a partir de uma face já confirmada (chamado por confirmAndExpand e
 * claimFace, depois que a linha em matches já existe com status='confirmed'):
 *  1. todas as faces da mesma pessoa (cluster) viram matches do usuário;
 *  2. o embedding confirmado roda como probe global (outros álbuns também).
 * Retorna quantos matches novos a expansão criou.
 */
async function expandFromConfirmedFace(faceId: string, userId: string): Promise<number> {
  let added = 0;

  // 1. propagação por pessoa — mesma pessoa no álbum = minhas fotos, sem depender do threshold
  const { rowCount: byPerson } = await pool.query(
    `INSERT INTO matches (face_id, user_id, distance)
     SELECT f2.id, $2, (f2.embedding <=> f.embedding)::real
     FROM faces f
     JOIN faces f2 ON f2.person_id = f.person_id
     WHERE f.id = $1 AND f.person_id IS NOT NULL AND f2.id <> f.id
     ON CONFLICT (face_id, user_id) DO NOTHING`,
    [faceId, userId]
  );
  added += byPerson ?? 0;

  // 2. expansão global — a face confirmada vira referência ("treino")
  const { rowCount: global } = await pool.query(
    `INSERT INTO matches (face_id, user_id, distance)
     SELECT f2.id, $2, (f2.embedding <=> probe.embedding)::real
     FROM faces probe
     JOIN faces f2 ON (f2.embedding <=> probe.embedding) <= $3
     WHERE probe.id = $1
       AND NOT EXISTS (
         SELECT 1 FROM rejected_people rp WHERE rp.user_id = $2 AND rp.person_id = f2.person_id
       )
     ON CONFLICT (face_id, user_id) DO NOTHING`,
    [faceId, userId, config.matchDistanceThreshold]
  );
  added += global ?? 0;

  return added;
}

/**
 * "Sou eu" num match já existente (auto): confirma e expande.
 * Retorna quantos matches novos a expansão criou, ou -1 se o match não existe.
 */
export async function confirmAndExpand(faceId: string, userId: string): Promise<number> {
  const { rowCount: confirmed } = await pool.query(
    `UPDATE matches SET status = 'confirmed' WHERE face_id = $1 AND user_id = $2 AND status <> 'rejected'`,
    [faceId, userId]
  );
  if (!confirmed) return -1; // match não existe (ou estava rejeitado)
  return expandFromConfirmedFace(faceId, userId);
}

/**
 * Autoidentificação ("Todas as fotos"): cria (ou confirma) um match pra uma
 * face que o sistema não casou sozinho — o usuário escolheu o rosto na tela.
 * Distância é calculada contra o enrollment ativo só como registro informativo
 * (pode ficar NULL se a pessoa não tem enrollment). Expande igual ao "Sou eu".
 */
export async function claimFace(faceId: string, userId: string): Promise<number> {
  const { rows } = await pool.query(
    `INSERT INTO matches (face_id, user_id, distance, status)
     SELECT $1, $2,
            (SELECT (f.embedding <=> e.embedding)::real
             FROM faces f, enrollments e
             WHERE f.id = $1 AND e.user_id = $2 AND e.active AND e.status = 'done' AND e.embedding IS NOT NULL),
            'confirmed'
     ON CONFLICT (face_id, user_id) DO UPDATE SET status = 'confirmed'
     WHERE matches.status <> 'rejected'
     RETURNING face_id`,
    [faceId, userId]
  );
  if (!rows[0]) return -1; // já estava rejeitado — respeita o "não sou eu" anterior
  return expandFromConfirmedFace(faceId, userId);
}

/**
 * "Não sou eu": rejeita a PESSOA inteira — marca os matches existentes do
 * cluster como rejected e registra em rejected_people (faces futuras desse
 * cluster nunca mais casam com o usuário).
 */
export async function rejectPerson(faceId: string, userId: string): Promise<boolean> {
  const { rows } = await pool.query(`SELECT person_id FROM faces WHERE id = $1`, [faceId]);
  if (!rows[0]) return false;
  const personId = rows[0].person_id as string | null;

  const { rowCount } = await pool.query(
    `UPDATE matches m SET status = 'rejected'
     FROM faces f
     WHERE f.id = m.face_id AND m.user_id = $2
       AND (f.id = $1 OR ($3::uuid IS NOT NULL AND f.person_id = $3))`,
    [faceId, userId, personId]
  );

  if (personId) {
    await pool.query(
      `INSERT INTO rejected_people (user_id, person_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [userId, personId]
    );
  }
  return (rowCount ?? 0) > 0;
}

/**
 * Recalcula todos os matches automáticos (preserva confirmed/rejected).
 * Usar após mudar MATCH_DISTANCE_THRESHOLD ou pra sanear dados.
 */
export async function rematchAll(): Promise<number> {
  await pool.query(`DELETE FROM matches WHERE status = 'auto'`);
  const { rowCount } = await pool.query(
    `WITH ${REFS_CTE}
     INSERT INTO matches (face_id, user_id, enrollment_id, distance)
     SELECT DISTINCT ON (f.id, r.user_id)
            f.id, r.user_id, r.enrollment_id, (f.embedding <=> r.embedding)::real AS d
     FROM faces f
     JOIN refs r ON (f.embedding <=> r.embedding) <= $1
     WHERE ${NOT_REJECTED}
     ORDER BY f.id, r.user_id, d
     ON CONFLICT (face_id, user_id) DO NOTHING`,
    [config.matchDistanceThreshold]
  );
  return rowCount ?? 0;
}
