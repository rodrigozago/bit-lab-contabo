import type { FastifyInstance } from "fastify";
import { v4 as uuid } from "uuid";
import type {
  ExportRequest,
  ExportJob,
  ApiResponse,
} from "@ponto-studio/shared";
import { convertProjectToSvg } from "../services/svgConverter.js";
import { enqueueJob, getJob } from "../services/jobQueue.js";
import * as projectsRepo from "../services/projectsRepo.js";

export async function exportRoutes(app: FastifyInstance) {
  // POST /api/export/svg — exportação síncrona: devolve o SVG do projeto
  // para download direto, sem depender do worker Python/Redis.
  app.post<{ Body: { projectId: string } }>(
    "/svg",
    async (req, reply) => {
      const project = await projectsRepo.get(req.body.projectId);
      if (!project) {
        return reply.status(404).send({ ok: false, error: "Project not found" });
      }
      const svgContent = convertProjectToSvg(project);
      const fileName = `${project.name.replace(/[^\w\-]+/g, "_") || "bordado"}.svg`;
      return reply
        .header("Content-Type", "image/svg+xml")
        .header("Content-Disposition", `attachment; filename="${fileName}"`)
        .send(svgContent);
    }
  );

  // POST /api/export  — cria job de exportação
  app.post<{ Body: ExportRequest }>(
    "/",
    async (req, reply): Promise<ApiResponse<ExportJob>> => {
      const { projectId, format } = req.body;

      const project = await projectsRepo.get(projectId);
      if (!project) {
        reply.status(404);
        return { ok: false, error: "Project not found" };
      }

      const svgContent = convertProjectToSvg(project);
      const jobId = uuid();
      const job = await enqueueJob({ jobId, svgContent, format, projectId });

      return { ok: true, data: job };
    }
  );

  // GET /api/export/:jobId — consulta status do job
  app.get<{ Params: { jobId: string } }>(
    "/:jobId",
    async (req, reply): Promise<ApiResponse<ExportJob>> => {
      const job = getJob(req.params.jobId);
      if (!job) {
        reply.status(404);
        return { ok: false, error: "Job not found" };
      }
      return { ok: true, data: job };
    }
  );
}
