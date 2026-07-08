import { pool } from "../db.js";
import { config } from "../config.js";

// Clustering incremental de faces em "pessoas" por álbum: cada face nova é
// atribuída ao cluster de centroide mais próximo (pgvector) ou vira uma pessoa
// nova. Centroide = média L2-normalizada dos membros (l2_normalize/avg(vector)
// existem no pgvector >= 0.7 — a imagem pgvector/pg16 atende).

async function assignFace(faceId: string, embeddingLiteral: string, albumId: string): Promise<void> {
  const { rows } = await pool.query(
    `SELECT id, (centroid <=> $2::vector)::real AS d
     FROM people WHERE album_id = $1
     ORDER BY centroid <=> $2::vector LIMIT 1`,
    [albumId, embeddingLiteral]
  );
  const nearest = rows[0];

  if (nearest && nearest.d <= config.clusterDistanceThreshold) {
    await pool.query(`UPDATE faces SET person_id = $2 WHERE id = $1`, [faceId, nearest.id]);
    await pool.query(
      `UPDATE people SET face_count = face_count + 1,
              centroid = (SELECT l2_normalize(avg(embedding)) FROM faces WHERE person_id = $1)
       WHERE id = $1`,
      [nearest.id]
    );
  } else {
    const { rows: created } = await pool.query(
      `INSERT INTO people (album_id, centroid, face_count, cover_face_id)
       VALUES ($1, $2::vector, 1, $3) RETURNING id`,
      [albumId, embeddingLiteral, faceId]
    );
    await pool.query(`UPDATE faces SET person_id = $2 WHERE id = $1`, [faceId, created[0].id]);
  }
}

/** Agrupa as faces recém-inseridas de uma foto (chamado pelo jobQueue). */
export async function assignPeopleForPhoto(photoId: string): Promise<void> {
  const { rows } = await pool.query(
    `SELECT f.id, f.embedding::text AS emb, p.album_id
     FROM faces f JOIN photos p ON p.id = f.photo_id
     WHERE f.photo_id = $1 AND f.person_id IS NULL
     ORDER BY f.det_score DESC`,
    [photoId]
  );
  for (const face of rows) {
    await assignFace(face.id, face.emb, face.album_id);
  }
}

/**
 * Reagrupa um álbum do zero (backfill de dados antigos ou re-tune de threshold).
 * Greedy em ordem de det_score DESC — seeds nítidos formam clusters melhores.
 * Nota: apaga as pessoas do álbum, o que zera rejected_people daquele álbum
 * (matches já rejeitados permanecem rejeitados).
 */
export async function reclusterAlbum(albumId: string): Promise<number> {
  await pool.query(
    `UPDATE faces SET person_id = NULL
     WHERE photo_id IN (SELECT id FROM photos WHERE album_id = $1)`,
    [albumId]
  );
  await pool.query(`DELETE FROM people WHERE album_id = $1`, [albumId]);

  const { rows } = await pool.query(
    `SELECT f.id, f.embedding::text AS emb
     FROM faces f JOIN photos p ON p.id = f.photo_id
     WHERE p.album_id = $1
     ORDER BY f.det_score DESC`,
    [albumId]
  );
  for (const face of rows) {
    await assignFace(face.id, face.emb, albumId);
  }

  const { rows: count } = await pool.query(`SELECT COUNT(*)::int AS n FROM people WHERE album_id = $1`, [albumId]);
  return count[0].n;
}

export async function reclusterAll(): Promise<{ albums: number; people: number }> {
  const { rows: albums } = await pool.query(`SELECT id FROM albums`);
  let people = 0;
  for (const album of albums) {
    people += await reclusterAlbum(album.id);
  }
  return { albums: albums.length, people };
}
