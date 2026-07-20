// ─── Domain Types ────────────────────────────────────────────────────────────

/**
 * Tipos de ponto suportados (motor = Ink/Stitch real, rodado via subprocess —
 * ver workers/embroidery/inkstitch_runner.py). Cada `type` aqui corresponde a
 * um `fill_method`/`stroke_method` do Ink/Stitch; os campos de cada variante
 * espelham só os parâmetros que o Ink/Stitch DE FATO lê pra aquele método —
 * confirmado empiricamente rodando o binário real (não por suposição: vários
 * nomes "óbvios" tinham nome errado e eram ignorados em silêncio, ver
 * docs/MOTOR-BORDADO-INKSTITCH.md seção 3.1/Fase 1).
 */
export type StitchType = "tatami" | "contour" | "meander" | "circular" | "satin" | "running";

/** Tatami — preenchimento uniforme (Ink/Stitch: `auto_fill`). O mais comum pra áreas grandes. */
export interface TatamiStitchParams {
  type: "tatami";
  /** 0.0 = esparso → 1.0 = denso (vira `row_spacing_mm`) */
  density: number;
  /** ângulo das linhas de varredura, 0–180° */
  angle: number;
  /** passada de base (perpendicular, esparsa) antes do preenchimento — estabiliza o tecido */
  underlay?: boolean;
  /** compensação de puxão em mm (0–0.5) — estica cada linha nas pontas pra compensar a tração do fio */
  pullCompensationMm?: number;
}

/**
 * Contorno — segue o contorno da forma de fora pra dentro (Ink/Stitch:
 * `contour_fill`). Era o que a UI antiga chamava de "Cetim"/"satin" — nunca
 * foi cetim de verdade (isso é `SatinColumn`, geometria de 2 trilhos, ainda
 * não implementada — ver Fase 3 do doc). `angle` e `pullCompensationMm`
 * NÃO se aplicam (confirmado: o Ink/Stitch ignora esses dois pra este método).
 */
export interface ContourStitchParams {
  type: "contour";
  /** 0.0 = esparso → 1.0 = denso (vira `row_spacing_mm`) */
  density: number;
  /** 0 = de fora pra dentro, 1 = espiral simples, 2 = espiral dupla */
  contourStrategy?: 0 | 1 | 2;
  /** evita que a linha de costura cruze a si mesma (mais lento de gerar) */
  avoidSelfCrossing?: boolean;
  underlay?: boolean;
}

/**
 * Meandro — textura leve e decorativa, tipo labirinto (Ink/Stitch:
 * `meander_fill`). Bom pra fundos/áreas grandes sem precisar de cobertura
 * densa. `row_spacing_mm`/`maxStitchLength`/`pullCompensationMm` NÃO se
 * aplicam (confirmado: esse método nem lê esses campos).
 */
export interface MeanderStitchParams {
  type: "meander";
  /** 0.0 = esparso → 1.0 = denso (vira `meander_scale_percent`, invertido: densidade alta = padrão menor) */
  density: number;
  /** id do padrão de textura (tile do Ink/Stitch) — fixo por ora, sem seletor na UI (75 opções sem nome amigável) */
  pattern?: string;
  /** ângulo do padrão, 0–180° */
  angle?: number;
  underlay?: boolean;
}

/**
 * Circular — espiral que preenche a partir do centro da forma (Ink/Stitch:
 * `circular_fill`). `angle`/`maxStitchLength`/`pullCompensationMm` NÃO se
 * aplicam. Ponto-alvo customizado (fora do centro) não é suportado ainda —
 * exigiria o sistema de "commands" visuais do Ink/Stitch (elemento SVG à
 * parte); sempre usa o centro geométrico da forma por enquanto.
 */
export interface CircularStitchParams {
  type: "circular";
  /** 0.0 = esparso → 1.0 = denso (vira `row_spacing_mm`) */
  density: number;
  underlay?: boolean;
}

/**
 * @deprecated Alias legado de `contour` — nunca foi cetim de verdade
 * (mapeava pra `contour_fill` desde sempre). Mantido só pra não quebrar
 * dados salvos antes desta migração; a UI trata como "Contorno" e não
 * oferece mais "satin" como opção nova. Cetim real (2 trilhos) é Fase 3.
 */
export interface SatinStitchParams {
  type: "satin";
  density: number;
  angle: number;
  underlay?: boolean;
  pullCompensationMm?: number;
}

/** Corrido — contorno/detalhe fino, ponto simples seguindo a linha (Ink/Stitch: `running_stitch`). */
export interface RunningStitchParams {
  type: "running";
  /** 0.0 = pontos longos → 1.0 = pontos curtos (vira `running_stitch_length_mm`, invertido) */
  density: number;
  angle: number;
}

export type StitchParams =
  | TatamiStitchParams
  | ContourStitchParams
  | MeanderStitchParams
  | CircularStitchParams
  | SatinStitchParams
  | RunningStitchParams;

/**
 * Uma "parte" do bordado — a unidade única do editor (antes havia dois conceitos
 * paralelos: "áreas" no modelo salvo e "camadas" só no tldraw). Cada parte é uma
 * região de cor com seu tipo de ponto, ordem de costura (posição no array),
 * visibilidade e agrupamento por importação — tudo persistido.
 */
export interface EmbroideryElement {
  id: string;
  /** SVG path data (d attribute) que delimita a área. Usado para shapes simples. */
  svgPath: string;
  /** SVG completo (quando gerado pela IA). Se presente, tem prioridade sobre svgPath no export. */
  svgContent?: string;
  /** cor em hex, ex: "#FF5733" */
  color: string;
  stitch: StitchParams;
  /** rótulo editável da parte; fallback exibido = `${tipo} — ${cor}` */
  name?: string;
  /** oculta a parte no canvas (persistido; antes só existia como truque no tldraw) */
  hidden?: boolean;
  /** agrupa partes vindas da mesma importação (foto/texto) */
  groupId?: string;
  /** nome do grupo de importação (ex.: nome do arquivo) */
  groupName?: string;
  /** rotação em radianos (persistida); aplicada na exportação do bordado */
  rotation?: number;
  /** true enquanto o stitch veio da heurística automática (limpa ao editar) */
  stitchSuggested?: boolean;
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

/** Métricas geométricas de uma camada de cor da análise (base da heurística
 * de sugestão de parâmetros de ponto — ver stitchHeuristics no web). */
export interface AnalyzeLayerMetrics {
  /** cor final da camada no SVG, hex #rrggbb */
  color: string;
  /** % da imagem coberta pela camada */
  areaPct: number;
  /** largura típica do traço em px da imagem analisada (2× distance transform) */
  meanWidthPx: number;
  maxWidthPx: number;
  /** nº de regiões desconectadas */
  regionCount: number;
  /** orientação do eixo principal, 0–180° (y pra baixo, como no SVG) */
  principalAngleDeg: number;
  /** razão dos eixos principais (≥1); alto = forma alongada (candidata a cetim) */
  elongation: number;
}

export interface AnalyzeMetrics {
  /** dimensões da imagem analisada (pós-downscale) — base pra converter px→mm */
  imageWidth: number;
  imageHeight: number;
  layers: AnalyzeLayerMetrics[];
}

export interface AnalyzeJobStatus {
  jobId: string;
  status: JobStatus;
  /** SVG resultante, presente quando status === "done" */
  svg?: string;
  /** métricas por camada (ausente em jobs de workers antigos) */
  metrics?: AnalyzeMetrics;
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
