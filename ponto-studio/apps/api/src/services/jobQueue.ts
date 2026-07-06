import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createClient } from "redis";
import type { ExportJob, ExportFormat } from "@ponto-studio/shared";

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

function updateJob(jobId: string, patch: Partial<ExportJob>): void {
  const existing = jobStore.get(jobId);
  if (!existing) return;
  jobStore.set(jobId, {
    ...existing,
    ...patch,
    updatedAt: new Date().toISOString(),
  });
}
