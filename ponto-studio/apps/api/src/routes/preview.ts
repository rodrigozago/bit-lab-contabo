import type { FastifyInstance } from "fastify";
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { v4 as uuid } from "uuid";
import type {
  AnalyzeJobStatus,
  EmbroideryElement,
  CanvasSize,
} from "@ponto-studio/shared";
import { buildElementPreviewSvg } from "../services/svgConverter.js";
import { enqueuePreviewJob, getJob } from "../services/jobQueue.js";
import { registerRequireSession } from "../services/requireSession.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXPORTS_DIR = join(__dirname, "..", "..", "exports");

interface PreviewRequest {
  element: EmbroideryElement;
  canvas: CanvasSize;
}

export async function previewRoutes(app: FastifyInstance) {
  // O element vem do próprio cliente (não busca recurso alheio no servidor),
  // então não há IDOR aqui — mas exigir sessão trava o abuso do worker por
  // anônimos (job pesado do Ink/Stitch).
  registerRequireSession(app);

  // POST /api/preview — gera o preview de linhas de ponto de um elemento
  app.post<{ Body: PreviewRequest }>("/", async (req, reply) => {
    const { element, canvas } = req.body;
    if (!element?.svgContent) {
      return reply.status(400).send({ ok: false, error: "element.svgContent é obrigatório" });
    }

    const jobId = uuid();
    const warnings: string[] = [];
    const svgContent = buildElementPreviewSvg(element, canvas, warnings);
    await enqueuePreviewJob({ jobId, svgContent, warnings });
    return reply.send({ ok: true, data: { jobId } });
  });

  // GET /api/preview/:jobId — status; quando done, devolve o SVG de pontos
  app.get<{ Params: { jobId: string } }>("/:jobId", async (req, reply) => {
    const job = getJob(req.params.jobId);
    if (!job) {
      return reply.status(404).send({ ok: false, error: "Job not found" });
    }

    const status: AnalyzeJobStatus = {
      jobId: job.jobId,
      status: job.status,
      ...(job.errorMessage ? { errorMessage: job.errorMessage } : {}),
      ...(job.warnings?.length ? { warnings: job.warnings } : {}),
    };

    if (job.status === "done") {
      const svgPath = join(EXPORTS_DIR, `${job.jobId}.svg`);
      if (!existsSync(svgPath)) {
        return reply.status(500).send({ ok: false, error: "Result file missing" });
      }
      status.svg = readFileSync(svgPath, "utf-8");
    }

    return reply.send({ ok: true, data: status });
  });
}
