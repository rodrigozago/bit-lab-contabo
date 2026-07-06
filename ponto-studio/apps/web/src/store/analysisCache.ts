/**
 * Cache de análises de imagem (OpenRouter) no localStorage.
 * Chave: hash simples do nome + tamanho do arquivo.
 * Guarda os últimos MAX_ENTRIES resultados.
 */

export interface CachedAnalysis {
  id: string;
  fileName: string;
  fileSize: number;
  previewDataUrl: string; // imagem original em base64 para exibir thumbnail
  svg: string;
  analyzedAt: string; // ISO8601
}

const STORAGE_KEY = "ponto-studio:analyses";
const MAX_ENTRIES = 20;

function load(): CachedAnalysis[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CachedAnalysis[]) : [];
  } catch {
    return [];
  }
}

function save(entries: CachedAnalysis[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // localStorage cheio — descarta o mais antigo e tenta de novo
    const trimmed = entries.slice(1);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed)); } catch { /* ignorado */ }
  }
}

/** Gera uma chave de cache a partir do arquivo. */
function cacheKey(file: File): string {
  return `${file.name}::${file.size}::${file.lastModified}`;
}

/** Retorna entrada cacheada para o arquivo, ou null se não existir. */
export function getCached(file: File): CachedAnalysis | null {
  const key = cacheKey(file);
  const entries = load();
  return entries.find((e) => cacheKey({ name: e.fileName, size: e.fileSize, lastModified: 0 } as File) === key
    || `${e.fileName}::${e.fileSize}` === `${file.name}::${file.size}`)
    ?? null;
}

/** Salva uma nova análise no cache. */
export function saveAnalysis(
  file: File,
  previewDataUrl: string,
  svg: string
): CachedAnalysis {
  const entry: CachedAnalysis = {
    id: crypto.randomUUID(),
    fileName: file.name,
    fileSize: file.size,
    previewDataUrl,
    svg,
    analyzedAt: new Date().toISOString(),
  };

  const entries = load().filter(
    (e) => !(e.fileName === file.name && e.fileSize === file.size)
  );
  entries.unshift(entry); // mais recente primeiro
  save(entries.slice(0, MAX_ENTRIES));
  return entry;
}

/** Retorna todas as análises cacheadas, mais recentes primeiro. */
export function listAnalyses(): CachedAnalysis[] {
  return load();
}

/** Remove uma entrada do cache pelo id. */
export function removeAnalysis(id: string): void {
  save(load().filter((e) => e.id !== id));
}
