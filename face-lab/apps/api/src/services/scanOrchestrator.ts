import { mkdir } from "fs/promises";
import { join } from "path";
import { pool } from "../db.js";
import { config } from "../config.js";
import { getAccessToken } from "./googleOAuth.js";
import { listFolderImages, downloadFile } from "./drive.js";
import { enqueue } from "./jobQueue.js";
import { waitForPhotoSlot } from "./rateLimit.js";

// Scan de álbum: lista a pasta do Drive do producer, registra fotos novas,
// baixa cada uma pra /media/incoming e enfileira pro worker. Incremental:
// UNIQUE(album_id, drive_file_id) faz rescans pegarem só arquivos novos.
// Originais são temporários — o worker apaga após extrair faces/thumb.

const running = new Set<string>();

export function isScanning(albumId: string): boolean {
  return running.has(albumId);
}

/** Dispara o scan em background (não aguardado pelo endpoint). */
export function startScan(albumId: string, ownerId: string): void {
  if (running.has(albumId)) return;
  running.add(albumId);
  void runScan(albumId, ownerId)
    .catch(async (err) => {
      console.error(`[scan] álbum ${albumId} falhou:`, err);
      await pool
        .query(`UPDATE albums SET status = 'error', error = $2 WHERE id = $1`, [albumId, String(err?.message ?? err)])
        .catch(() => {});
    })
    .finally(() => running.delete(albumId));
}

async function runScan(albumId: string, ownerId: string): Promise<void> {
  await pool.query(`UPDATE albums SET status = 'scanning', error = NULL WHERE id = $1`, [albumId]);

  const { rows } = await pool.query(`SELECT drive_folder_id FROM albums WHERE id = $1`, [albumId]);
  const folderId = rows[0]?.drive_folder_id as string | undefined;
  if (!folderId) throw new Error("álbum não encontrado");

  const accessToken = await getAccessToken(ownerId);
  const files = await listFolderImages(accessToken, folderId);
  console.log(`[scan] álbum ${albumId}: ${files.length} imagens na pasta do Drive`);

  // upsert de metadados: fotos novas entram pending; existentes só atualizam links
  for (const f of files) {
    await pool.query(
      `INSERT INTO photos (album_id, drive_file_id, name, mime_type, taken_at, web_view_link, web_content_link)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (album_id, drive_file_id) DO UPDATE
         SET name = EXCLUDED.name, web_view_link = EXCLUDED.web_view_link, web_content_link = EXCLUDED.web_content_link`,
      [albumId, f.id, f.name, f.mimeType, f.takenAt, f.webViewLink, f.webContentLink]
    );
  }

  const incomingDir = join(config.mediaDir, "incoming");
  await mkdir(incomingDir, { recursive: true });

  // fotos ainda não processadas (novas ou re-tentativa de erro)
  const pending = await pool.query(
    `SELECT id, drive_file_id FROM photos WHERE album_id = $1 AND status IN ('pending', 'error') ORDER BY created_at`,
    [albumId]
  );

  if (pending.rows.length === 0) {
    await pool.query(
      `UPDATE albums a SET status = 'ready', scanned_at = now()
       WHERE a.id = $1 AND NOT EXISTS (
         SELECT 1 FROM photos p WHERE p.album_id = a.id AND p.status IN ('pending', 'processing'))`,
      [albumId]
    );
    return;
  }

  let token = accessToken;
  let tokenIssuedAt = Date.now();

  for (const photo of pending.rows) {
    // rate limit por producer + global: não falha, só desacelera o scan
    await waitForPhotoSlot(ownerId);

    // access tokens do Google duram ~1h — renova preventivamente em scans longos
    if (Date.now() - tokenIssuedAt > 45 * 60_000) {
      token = await getAccessToken(ownerId);
      tokenIssuedAt = Date.now();
    }

    const destPath = join(incomingDir, `${photo.id}.img`);
    try {
      await downloadFile(token, photo.drive_file_id, destPath);
      await pool.query(`UPDATE photos SET status = 'processing', error = NULL WHERE id = $1`, [photo.id]);
      await enqueue({ type: "process_photo", photoId: photo.id, imagePath: destPath });
    } catch (err) {
      console.error(`[scan] download falhou (photo ${photo.id}):`, err);
      await pool.query(`UPDATE photos SET status = 'error', error = $2 WHERE id = $1`, [
        photo.id,
        `download: ${String((err as Error)?.message ?? err)}`,
      ]);
    }
  }
  // álbum vira 'ready' quando o último resultado chegar (ver jobQueue.refreshAlbumStatus)
}
