import type { FastifyInstance } from "fastify";
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { v4 as uuid } from "uuid";
import type { StitchPattern, StitchPreviewJobStatus } from "@ponto-studio/shared";
import { convertProjectToSvg } from "../services/svgConverter.js";
import { enqueueStitchDataJob, getJob } from "../services/jobQueue.js";
import * as projectsRepo from "../services/projectsRepo.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXPORTS_DIR = join(__dirname, "..", "..", "exports");

export async function stitchPreviewRoutes(app: FastifyInstance) {
  // POST /api/stitch-preview — gera a sequência de pontos do projeto inteiro,
  // pro player de simulação (EXP-2). Mesmo motor de pontos do export (DST).
  app.post<{ Body: { projectId: string } }>("/", async (req, reply) => {
    const project = await projectsRepo.get(req.body.projectId);
    if (!project) {
      return reply.status(404).send({ ok: false, error: "Project not found" });
    }

    const jobId = uuid();
    const svgContent = convertProjectToSvg(project);
    await enqueueStitchDataJob({ jobId, svgContent });
    return reply.send({ ok: true, data: { jobId } });
  });

  // GET /api/stitch-preview/:jobId — status; quando done, devolve os pontos
  app.get<{ Params: { jobId: string } }>("/:jobId", async (req, reply) => {
    const job = getJob(req.params.jobId);
    if (!job) {
      return reply.status(404).send({ ok: false, error: "Job not found" });
    }

    const status: StitchPreviewJobStatus = {
      jobId: job.jobId,
      status: job.status,
      ...(job.errorMessage ? { errorMessage: job.errorMessage } : {}),
    };

    if (job.status === "done") {
      const jsonPath = join(EXPORTS_DIR, `${job.jobId}.json`);
      if (!existsSync(jsonPath)) {
        return reply.status(500).send({ ok: false, error: "Result file missing" });
      }
      status.pattern = JSON.parse(readFileSync(jsonPath, "utf-8")) as StitchPattern;
    }

    return reply.send({ ok: true, data: status });
  });
}
