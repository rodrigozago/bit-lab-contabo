import { createWriteStream } from "fs";
import { pipeline } from "stream/promises";
import { Readable } from "stream";

// Google Drive API v3 via REST — listagem e download das fotos do álbum.
// As fotos ficam no Drive do producer; baixamos temporariamente pra processar.

const API = "https://www.googleapis.com/drive/v3";

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string | null;
  webContentLink: string | null;
  takenAt: string | null;
}

/** Extrai o folderId de um link do Drive (ou aceita o ID cru). */
export function parseFolderId(input: string): string | null {
  const trimmed = input.trim();
  const m = trimmed.match(/folders\/([a-zA-Z0-9_-]+)/);
  if (m?.[1]) return m[1];
  if (/^[a-zA-Z0-9_-]{10,}$/.test(trimmed)) return trimmed;
  return null;
}

async function driveGet(accessToken: string, path: string): Promise<Response> {
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Drive API ${path.split("?")[0]} falhou: ${res.status} ${await res.text()}`);
  return res;
}

export interface FolderInfo {
  name: string;
  linkShared: boolean;
}

/** Valida a pasta e verifica se está compartilhada por link (necessário pros downloads dos guests). */
export async function getFolderInfo(accessToken: string, folderId: string): Promise<FolderInfo> {
  const res = await driveGet(accessToken, `/files/${folderId}?fields=id,name,mimeType`);
  const meta = (await res.json()) as { name: string; mimeType: string };
  if (meta.mimeType !== "application/vnd.google-apps.folder") {
    throw new Error("o link não aponta pra uma pasta do Drive");
  }

  let linkShared = false;
  try {
    const permRes = await driveGet(accessToken, `/files/${folderId}/permissions?fields=permissions(type)`);
    const perms = (await permRes.json()) as { permissions?: { type: string }[] };
    linkShared = (perms.permissions ?? []).some((p) => p.type === "anyone");
  } catch {
    // sem permissão pra listar permissions — segue sem o aviso
  }
  return { name: meta.name, linkShared };
}

/** Lista todas as imagens da pasta (paginado). */
export async function listFolderImages(accessToken: string, folderId: string): Promise<DriveFile[]> {
  const files: DriveFile[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({
      q: `'${folderId}' in parents and mimeType contains 'image/' and trashed = false`,
      fields: "nextPageToken, files(id, name, mimeType, webViewLink, webContentLink, imageMediaMetadata(time))",
      pageSize: "1000",
      ...(pageToken ? { pageToken } : {}),
    });
    const res = await driveGet(accessToken, `/files?${params.toString()}`);
    const data = (await res.json()) as {
      nextPageToken?: string;
      files: {
        id: string;
        name: string;
        mimeType: string;
        webViewLink?: string;
        webContentLink?: string;
        imageMediaMetadata?: { time?: string };
      }[];
    };
    for (const f of data.files) {
      files.push({
        id: f.id,
        name: f.name,
        mimeType: f.mimeType,
        webViewLink: f.webViewLink ?? null,
        webContentLink: f.webContentLink ?? null,
        takenAt: parseDriveTime(f.imageMediaMetadata?.time),
      });
    }
    pageToken = data.nextPageToken;
  } while (pageToken);
  return files;
}

// EXIF time do Drive vem como "2024:06:15 21:03:11"
function parseDriveTime(t: string | undefined): string | null {
  if (!t) return null;
  const m = t.match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}:\d{2}:\d{2})/);
  if (!m) return null;
  const iso = `${m[1]}-${m[2]}-${m[3]}T${m[4]}Z`;
  return Number.isNaN(Date.parse(iso)) ? null : iso;
}

/** Baixa o conteúdo do arquivo pra `destPath` (temporário — apagado após processar). */
export async function downloadFile(accessToken: string, fileId: string, destPath: string): Promise<void> {
  const res = await fetch(`${API}/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok || !res.body) {
    throw new Error(`download do Drive falhou (${fileId}): ${res.status}`);
  }
  await pipeline(Readable.fromWeb(res.body as import("stream/web").ReadableStream), createWriteStream(destPath));
}
