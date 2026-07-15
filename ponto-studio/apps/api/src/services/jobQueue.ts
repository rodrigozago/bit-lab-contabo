import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createClient } from "redis";
import type { ExportJob, ExportFormat, LocalAnalyzeParams } from "@ponto-studio/shared";

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXPORTS_DIR = join(__dirname, "..", "..", "exports");
mkdirSync(EXPORTS_DIR, { recursive: true });

// ── Redis ──────────────────────────────────────────────────────────────────────
const REDIS_URL = process.env["REDIS_URL"] ?? "redis://localhost:6379";
const JOBS_QUEUE = "embroidery:jobs";
const RESULTS_CHANNEL = "embroidery:results";

type RedisClient = ReturnType<typeof createClient>;

let publisher: RedisClient | null = null;
let subscriber: RedisClient | null = null;

async function getPublisher(): Promise<RedisClient> {
  if (!publisher) {
    publisher = createClient({ url: REDIS_URL });
    publisher.on("error", (err: Error) =>
      console.error("[redis:pub] error:", err)
    );
    await publisher.connect();
  }
  return publisher;
}

// ── In-memory job store ────────────────────────────────────────────────────────
const jobStore = new Map<string, ExportJob>();

export function getJob(jobId: string): ExportJob | undefined {
  return jobStore.get(jobId);
}

// ── Subscribe to worker results ────────────────────────────────────────────────
export async function startResultListener(): Promise<void> {
  subscriber = createClient({ url: REDIS_URL });
  subscriber.on("error", (err: Error) =>
    console.error("[redis:sub] error:", err)
  );
  await subscriber.connect();

  const baseUrl =
    process.env["PUBLIC_URL"] ??
    `http://localhost:${process.env["PORT"] ?? 3001}`;

  await subscriber.subscribe(RESULTS_CHANNEL, (message: string) => {
    try {
      const result = JSON.parse(message) as {
        jobId: string;
        status: "done" | "error";
        outputFile?: string;
        error?: string;
      };

      if (result.status === "done" && result.outputFile) {
        const downloadUrl = `${baseUrl}/exports/${result.outputFile}`;
        updateJob(result.jobId, { status: "done", downloadUrl });
      } else {
        updateJob(result.jobId, {
          status: "error",
          errorMessage: result.error ?? "Worker failed",
        });
      }
    } catch (err) {
      console.error("[redis:sub] failed to parse result message:", err);
    }
  });

  console.log(
    "[jobQueue] listening for worker results on channel:",
    RESULTS_CHANNEL
  );
}

// ── Enqueue ────────────────────────────────────────────────────────────────────
export async function enqueueJob(params: {
  jobId: string;
  svgContent: string;
  format: ExportFormat;
  projectId: string;
}): Promise<ExportJob> {
  const { jobId, svgContent, format, projectId } = params;
  const now = new Date().toISOString();

  const job: ExportJob = {
    jobId,
    projectId,
    format,
    status: "pending",
    createdAt: now,
    updatedAt: now,
  };
  jobStore.set(jobId, job);

  // Persiste o SVG para que o worker possa lê-lo pelo caminho
  const svgFile = `${jobId}.svg`;
  const svgPath = join(EXPORTS_DIR, svgFile);
  writeFileSync(svgPath, svgContent, "utf-8");

  // Publica o job na fila do Redis
  const payload = JSON.stringify({ jobId, svgFile, format, projectId });
  const pub = await getPublisher();
  await pub.rPush(JOBS_QUEUE, payload);

  return job;
}

// ── Enqueue: análise local (processamento digital, sem IA) ────────────────────
// Reusa a mesma fila/canal com type:"analyze" — o worker faz o dispatch.
// O resultado chega pelo mesmo listener acima ({jobId}.svg em /exports).
export async function enqueueAnalyzeJob(params: {
  jobId: string;
  imageFile: string;
  analyzeParams: LocalAnalyzeParams;
}): Promise<ExportJob> {
  const { jobId, imageFile, analyzeParams } = params;
  const now = new Date().toISOString();

  const job: ExportJob = {
    jobId,
    projectId: "",
    format: "DST", // não usado em jobs de análise — campo exigido pelo tipo
    status: "pending",
    createdAt: now,
    updatedAt: now,
  };
  jobStore.set(jobId, job);

  const payload = JSON.stringify({
    type: "analyze",
    jobId,
    imageFile,
    params: analyzeParams,
  });
  const pub = await getPublisher();
  await pub.rPush(JOBS_QUEUE, payload);

  return job;
}

// ── Enqueue: preview de bordado (SVG-entrada → linhas de ponto) ───────────────
// Grava o SVG anotado em exports/{jobId}.in.svg e enfileira type:"preview".
// O worker devolve exports/{jobId}.svg (mesmo listener/jobStore).
export async function enqueuePreviewJob(params: {
  jobId: string;
  svgContent: string;
}): Promise<ExportJob> {
  const { jobId, svgContent } = params;
  const now = new Date().toISOString();

  const job: ExportJob = {
    jobId,
    projectId: "",
    format: "DST", // não usado em preview — campo exigido pelo tipo
    status: "pending",
    createdAt: now,
    updatedAt: now,
  };
  jobStore.set(jobId, job);

  const inputFile = `${jobId}.in.svg`;
  writeFileSync(join(EXPORTS_DIR, inputFile), svgContent, "utf-8");

  const payload = JSON.stringify({ type: "preview", jobId, svgFile: inputFile });
  const pub = await getPublisher();
  await pub.rPush(JOBS_QUEUE, payload);

  return job;
}

// ── Enqueue: dados do player de simulação (EXP-2) ──────────────────────────────
// SVG do projeto inteiro (mesmo formato do export) → sequência de pontos em
// JSON. Grava exports/{jobId}.in.svg e enfileira type:"stitch_data"; o worker
// devolve exports/{jobId}.json (mesmo listener/jobStore).
export async function enqueueStitchDataJob(params: {
  jobId: string;
  svgContent: string;
}): Promise<ExportJob> {
  const { jobId, svgContent } = params;
  const now = new Date().toISOString();

  const job: ExportJob = {
    jobId,
    projectId: "",
    format: "DST", // não usado em stitch_data — campo exigido pelo tipo
    status: "pending",
    createdAt: now,
    updatedAt: now,
  };
  jobStore.set(jobId, job);

  const inputFile = `${jobId}.in.svg`;
  writeFileSync(join(EXPORTS_DIR, inputFile), svgContent, "utf-8");

  const payload = JSON.stringify({ type: "stitch_data", jobId, svgFile: inputFile });
  const pub = await getPublisher();
  await pub.rPush(JOBS_QUEUE, payload);

  return job;
}

function updateJob(jobId: string, patch: Partial<ExportJob>): void {
  const existing = jobStore.get(jobId);
  if (!existing) return;
  jobStore.set(jobId, {
    ...existing,
    ...patch,
    updatedAt: new Date().toISOString(),
  });
}
