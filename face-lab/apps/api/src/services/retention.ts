import { unlink } from "fs/promises";
import { join } from "path";
import { pool } from "../db.js";
import { config } from "../config.js";

/**
 * Arquiva álbuns sem re-scan há mais de RETENTION_DAYS: apaga a mídia
 * biométrica (thumbs/crops/faces, e por cascade os matches) mas MANTÉM
 * álbum/fotos/metadados/links do Drive. Fotos voltam a 'pending' — um
 * re-scan (que já desarquiva, sem endpoint novo) reprocessa tudo de novo.
 */
export async function runRetentionSweep(): Promise<void> {
  const { rows: albums } = await pool.query(
    `SELECT id FROM albums WHERE status = 'ready' AND scanned_at < now() - ($1 || ' days')::interval`,
    [config.retentionDays]
  );

  for (const { id: albumId } of albums) {
    try {
      await archiveAlbum(albumId);
      console.log(`[retention] álbum ${albumId} arquivado (>${config.retentionDays}d sem re-scan)`);
    } catch (err) {
      console.error(`[retention] falha ao arquivar álbum ${albumId}:`, err);
    }
  }
}

async function archiveAlbum(albumId: string): Promise<void> {
  const { rows: media } = await pool.query(
    `SELECT p.thumb_path, f.crop_path FROM photos p LEFT JOIN faces f ON f.photo_id = p.id WHERE p.album_id = $1`,
    [albumId]
  );
  for (const row of media) {
    if (row.thumb_path) await unlink(join(config.mediaDir, row.thumb_path)).catch(() => {});
    if (row.crop_path) await unlink(join(config.mediaDir, row.crop_path)).catch(() => {});
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // cascade de faces já limpa matches; people referencia faces só por cover_face_id (sem FK)
    await client.query(`DELETE FROM faces WHERE photo_id IN (SELECT id FROM photos WHERE album_id = $1)`, [albumId]);
    await client.query(`DELETE FROM people WHERE album_id = $1`, [albumId]);
    await client.query(
      `UPDATE photos SET status = 'pending', thumb_path = NULL, error = NULL WHERE album_id = $1`,
      [albumId]
    );
    await client.query(`UPDATE albums SET status = 'archived' WHERE id = $1`, [albumId]);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
