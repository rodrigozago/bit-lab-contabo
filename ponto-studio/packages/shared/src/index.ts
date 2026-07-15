// ─── Domain Types ────────────────────────────────────────────────────────────

export type StitchType = "satin" | "tatami" | "running";

export interface StitchParams {
  type: StitchType;
  /** 0.0 = esparso → 1.0 = denso */
  density: number;
  /** ângulo em graus, 0–180 */
  angle: number;
}

export interface EmbroideryElement {
  id: string;
  /** SVG path data (d attribute) que delimita a área. Usado para shapes simples. */
  svgPath: string;
  /** SVG completo (quando gerado pela IA). Se presente, tem prioridade sobre svgPath no export. */
  svgContent?: string;
  /** cor em hex, ex: "#FF5733" */
  color: string;
  stitch: StitchParams;
}

export interface CanvasSize {
  widthMm: number;
  heightMm: number;
}

export interface EmbroideryProject {
  id: string;
  name: string;
  canvas: CanvasSize;
  elements: EmbroideryElement[];
  createdAt: string;
  updatedAt: string;
}

// ─── API Contracts ────────────────────────────────────────────────────────────

export interface CreateProjectRequest {
  name: string;
  canvas: CanvasSize;
}

export interface UpdateProjectRequest {
  name?: string;
  canvas?: CanvasSize;
  elements?: EmbroideryElement[];
}

export type ExportFormat = "DST" | "PES" | "JEF";

export interface ExportRequest {
  projectId: string;
  format: ExportFormat;
}

export type JobStatus = "pending" | "processing" | "done" | "error";

export interface ExportJob {
  jobId: string;
  projectId: string;
  format: ExportFormat;
  status: JobStatus;
  downloadUrl?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── API Response Envelopes ───────────────────────────────────────────────────

export interface ApiSuccess<T> {
  ok: true;
  data: T;
}

export interface ApiError {
  ok: false;
  error: string;
  details?: unknown;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

// ─── Worker Contracts (Redis queue payload) ──────────────────────────────────

export interface WorkerJobPayload {
  jobId: string;
  /** Nome do arquivo SVG em /exports (ex: "<jobId>.svg") */
  svgFile: string;
  format: ExportFormat;
  projectId: string;
}

export interface WorkerJobResult {
  jobId: string;
  status: "done" | "error";
  /** Nome do arquivo gerado em /exports (ex: "<jobId>.dst") */
  outputFile?: string;
  error?: string;
}

// ─── Análise local (processamento digital, sem IA) ───────────────────────────

export interface LocalAnalyzeParams {
  /** Nº de cores/linhas de bordado (1–8). 1 = só o primeiro plano, fundo excluído automaticamente */
  colors: number;
  /** Regiões menores que isso (% da área da imagem) são absorvidas */
  minRegionPct: number;
  /** 1 = mais liso, 3 = mais detalhe */
  detail: number;
  /** ΔE (Lab) abaixo do qual duas cores são fundidas na mesma camada (0–40) */
  colorTolerance: number;
  /** Teto duro de camadas no SVG final (1–8) — funde as cores mais próximas até caber no limite */
  maxAreas: number;
}

export interface AnalyzeJobStatus {
  jobId: string;
  status: JobStatus;
  /** SVG resultante, presente quando status === "done" */
  svg?: string;
  errorMessage?: string;
}

// ─── Player de simulação de bordado (EXP-2) ──────────────────────────────────

/** STITCH | JUMP | COLOR_BREAK | TRIM | END */
export type StitchCommand = 0 | 1 | 2 | 3 | 4;

export interface StitchPattern {
  viewBox: string;
  /** cores dos fios, na ordem em que aparecem no bordado */
  threads: string[];
  /** [x_mm, y_mm, cmd] por ponto, na ordem de costura */
  stitches: [number, number, StitchCommand][];
  stats: { totalStitches: number; colorCount: number };
}

export interface StitchPreviewJobStatus {
  jobId: string;
  status: JobStatus;
  /** sequência de pontos do projeto, presente quando status === "done" */
  pattern?: StitchPattern;
  errorMessage?: string;
}
