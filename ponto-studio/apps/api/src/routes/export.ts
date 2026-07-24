import type { FastifyInstance } from "fastify";
import { v4 as uuid } from "uuid";
import type {
  ExportRequest,
  ExportJob,
  ApiResponse,
} from "@ponto-studio/shared";
import { convertProjectToSvg } from "../services/svgConverter.js";
import { enqueueJob, getJob } from "../services/jobQueue.js";
import { registerRequireSession, ownerId } from "../services/requireSession.js";
import * as projectsRepo from "../services/projectsRepo.js";

export async function exportRoutes(app: FastifyInstance) {
  registerRequireSession(app);

  const projectIdBody = {
    type: "object",
    required: ["projectId"],
    additionalProperties: false,
    properties: { projectId: { type: "string", format: "uuid" } },
  } as const;

  // POST /api/export/svg — exportação síncrona: devolve o SVG do projeto
  // para download direto, sem depender do worker Python/Redis.
  app.post<{ Body: { projectId: string } }>(
    "/svg",
    { schema: { body: projectIdBody } },
    async (req, reply) => {
      const project = await projectsRepo.get(req.body.projectId);
      // 404 (não 403) quando não é do dono — evita vazar existência, mesmo
      // padrão de projects.ts. Antes NÃO havia checagem: qualquer projectId
      // exportava o desenho de qualquer usuário (IDOR).
      if (!project || project.ownerId !== ownerId(req)) {
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
    {
      schema: {
        body: {
          type: "object",
          required: ["projectId", "format"],
          additionalProperties: false,
          properties: {
            projectId: { type: "string", format: "uuid" },
            format: { type: "string", enum: ["DST", "PES", "JEF"] },
          },
        },
      },
    },
    async (req, reply): Promise<ApiResponse<ExportJob>> => {
      const { projectId, format } = req.body;

      const project = await projectsRepo.get(projectId);
      if (!project || project.ownerId !== ownerId(req)) {
        reply.status(404);
        return { ok: false, error: "Project not found" };
      }

      const warnings: string[] = [];
      const svgContent = convertProjectToSvg(project, warnings);
      const jobId = uuid();
      const job = await enqueueJob({ jobId, svgContent, format, projectId, warnings });

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
