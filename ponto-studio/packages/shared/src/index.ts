// ─── Domain Types ────────────────────────────────────────────────────────────

export type StitchType = "satin" | "tatami" | "running";

export interface StitchParams {
  type: StitchType;
  /** 0.0 = esparso → 1.0 = denso */
  density: number;
  /** ângulo em graus, 0–180 */
  angle: number;
  /** passada de base (perpendicular, esparsa) antes do preenchimento — estabiliza o tecido */
  underlay?: boolean;
  /** compensação de puxão em mm (0–0.5) — estica cada linha nas pontas pra compensar a tração do fio */
  pullCompensationMm?: number;
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

/**
 * px por mm no page-space do tldraw — mapeia o overlay do bastidor no editor
 * (apps/web/Editor.tsx) para os mesmos mm reais usados pelo export/estimativas
 * (apps/api/svgConverter.ts). Precisa ser o MESMO valor nos dois lados: é o
 * que faz redimensionar uma camada no canvas realmente mudar o tamanho do
 * bordado exportado, em vez do desenho sempre ser esticado pro bastidor inteiro.
 */
export const HOOP_PX_PER_MM = 4;

// ─── Bastidores (hoops) ───────────────────────────────────────────────────────

export interface Hoop {
  id: string;
  /** ex: 'Brother PE800 (5"×7")' */
  name: string;
  widthMm: number;
  heightMm: number;
  /** sub (OIDC) do dono — presente só nos bastidores customizados */
  ownerId?: string;
}

/**
 * Bastidores das máquinas domésticas/semi-industriais mais populares —
 * lista padrão, igual pra todos os usuários (customizados vêm do banco).
 * Medidas = área útil de bordado do bastidor que acompanha a máquina.
 */
export const DEFAULT_HOOPS: Hoop[] = [
  { id: "default-brother-4x4", name: 'Brother PE535 / SE600 (4"×4")', widthMm: 100, heightMm: 100 },
  { id: "default-brother-5x7", name: 'Brother PE800 / PE900 (5"×7")', widthMm: 130, heightMm: 180 },
  { id: "default-brother-6x10", name: 'Brother Innov-is NQ1700E (6"×10")', widthMm: 160, heightMm: 260 },
  { id: "default-brother-8x12", name: 'Brother PR680W (8"×12")', widthMm: 200, heightMm: 300 },
  { id: "default-janome-sq14", name: "Janome 230E / MC400E (SQ14)", widthMm: 140, heightMm: 140 },
  { id: "default-janome-sq20", name: "Janome MC500E (SQ20)", widthMm: 200, heightMm: 200 },
  { id: "default-janome-re28", name: "Janome MC500E (RE28)", widthMm: 200, heightMm: 280 },
  { id: "default-singer-xl580", name: "Singer Futura XL-580", widthMm: 160, heightMm: 260 },
  { id: "default-elna-830", name: "Elna eXpressive 830", widthMm: 140, heightMm: 200 },
  { id: "default-industrial-12x14", name: 'Tajima / industrial (12"×14")', widthMm: 300, heightMm: 350 },
];

export interface EmbroideryProject {
  id: string;
  name: string;
  canvas: CanvasSize;
  elements: EmbroideryElement[];
  /** sub (OIDC) do usuário dono do projeto — ausente em projetos criados antes do login existir */
  ownerId?: string;
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
  /** Nº de cores/linhas de bordado (1–8) — cores DO DESENHO (fundo tratado à parte) */
  colors: number;
  /** Regiões menores que isso (% da área da imagem) são absorvidas */
  minRegionPct: number;
  /** 1 = mais liso, 3 = mais detalhe */
  detail: number;
  /** ΔE (Lab) abaixo do qual duas cores são fundidas na mesma camada (0–40) */
  colorTolerance: number;
  /** Teto duro de camadas no SVG final (1–8) — funde as cores mais próximas até caber no limite */
  maxAreas: number;
  /** Detecta e remove o fundo automaticamente (default true) — sem isso o fundo vira camada de bordado */
  excludeBackground: boolean;
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
