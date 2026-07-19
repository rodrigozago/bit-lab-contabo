import type { FastifyInstance } from "fastify";
import { createWriteStream, mkdirSync, readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { pipeline } from "stream/promises";
import { v4 as uuid } from "uuid";
import type { AnalyzeJobStatus, LocalAnalyzeParams } from "@ponto-studio/shared";
import { enqueueAnalyzeJob, getJob } from "../services/jobQueue.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = join(__dirname, "..", "..", "uploads");
const EXPORTS_DIR = join(__dirname, "..", "..", "exports");
mkdirSync(UPLOADS_DIR, { recursive: true });

/** Lê um field de multipart como número, com default. */
function fieldNumber(fields: Record<string, unknown>, name: string, fallback: number): number {
  const field = fields[name] as { value?: string } | undefined;
  const parsed = field?.value !== undefined ? Number(field.value) : NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function analyzeRoutes(app: FastifyInstance) {
  // POST /api/analyze/local — análise por processamento digital (sem IA).
  // Salva a imagem em uploads/ (volume compartilhado com o worker) e enfileira
  // um job type:"analyze". O front acompanha via GET /local/:jobId.
  app.post("/local", async (req, reply) => {
    const data = await req.file();
    if (!data) {
      return reply.status(400).send({ ok: false, error: "No file uploaded" });
    }
    if (!["image/png", "image/jpeg"].includes(data.mimetype)) {
      return reply.status(400).send({ ok: false, error: "Only PNG and JPEG are accepted" });
    }

    const jobId = uuid();
    const ext = data.mimetype === "image/png" ? ".png" : ".jpg";
    const imageFile = `${jobId}${ext}`;
    await pipeline(data.file, createWriteStream(join(UPLOADS_DIR, imageFile)));

    const excludeBgField = data.fields["excludeBackground"] as { value?: string } | undefined;
    const analyzeParams: LocalAnalyzeParams = {
      colors: fieldNumber(data.fields, "colors", 4),
      minRegionPct: fieldNumber(data.fields, "minRegionPct", 0),
      detail: fieldNumber(data.fields, "detail", 2),
      colorTolerance: fieldNumber(data.fields, "colorTolerance", 10),
      maxAreas: fieldNumber(data.fields, "maxAreas", 8),
      excludeBackground: excludeBgField?.value !== "false",
    };

    await enqueueAnalyzeJob({ jobId, imageFile, analyzeParams });
    return reply.send({ ok: true, data: { jobId } });
  });

  // GET /api/analyze/local/:jobId — status do job; quando done, devolve o SVG
  app.get<{ Params: { jobId: string } }>("/local/:jobId", async (req, reply) => {
    const job = getJob(req.params.jobId);
    if (!job) {
      return reply.status(404).send({ ok: false, error: "Job not found" });
    }

    const status: AnalyzeJobStatus = {
      jobId: job.jobId,
      status: job.status,
      ...(job.errorMessage ? { errorMessage: job.errorMessage } : {}),
    };

    if (job.status === "done") {
      const svgPath = join(EXPORTS_DIR, `${job.jobId}.svg`);
      if (!existsSync(svgPath)) {
        return reply.status(500).send({ ok: false, error: "Result file missing" });
      }
      status.svg = readFileSync(svgPath, "utf-8");

      // métricas por camada (heurística de parâmetros) — tolerante à ausência
      // (worker antigo não grava o arquivo)
      const metricsPath = join(EXPORTS_DIR, `${job.jobId}.metrics.json`);
      if (existsSync(metricsPath)) {
        try {
          status.metrics = JSON.parse(readFileSync(metricsPath, "utf-8"));
        } catch {
          // metrics corrompido não deve derrubar a análise
        }
      }
    }

    return reply.send({ ok: true, data: status });
  });
}
