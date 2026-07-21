import type { FastifyInstance } from "fastify";
import { v4 as uuid } from "uuid";
import type {
  EmbroideryProject,
  CreateProjectRequest,
  UpdateProjectRequest,
  ApiResponse,
} from "@ponto-studio/shared";
import { registerRequireSession, ownerId } from "../services/requireSession.js";
import * as projectsRepo from "../services/projectsRepo.js";

export async function projectsRoutes(app: FastifyInstance) {
  // Projetos são dados sensíveis por usuário — exige sessão em todas as
  // rotas deste plugin (o gate no front já impede chegar aqui deslogado,
  // mas a API não deve confiar só nisso).
  registerRequireSession(app);

  // GET /api/projects — só os do usuário logado
  app.get("/", async (req): Promise<ApiResponse<EmbroideryProject[]>> => {
    const mine = await projectsRepo.listByOwner(ownerId(req));
    return { ok: true, data: mine };
  });

  // GET /api/projects/:id — 404 (não 403) se não for do dono, evita vazar existência
  app.get<{ Params: { id: string } }>(
    "/:id",
    async (req, reply): Promise<ApiResponse<EmbroideryProject>> => {
      const project = await projectsRepo.get(req.params.id);
      if (!project || project.ownerId !== ownerId(req)) {
        reply.status(404);
        return { ok: false, error: "Project not found" };
      }
      return { ok: true, data: project };
    }
  );

  const canvasSchema = {
    type: "object",
    required: ["widthMm", "heightMm"],
    properties: {
      widthMm: { type: "number", minimum: 1, maximum: 2000 },
      heightMm: { type: "number", minimum: 1, maximum: 2000 },
    },
  } as const;

  // POST /api/projects
  app.post<{ Body: CreateProjectRequest }>(
    "/",
    {
      schema: {
        body: {
          type: "object",
          required: ["name", "canvas"],
          properties: {
            name: { type: "string", minLength: 1, maxLength: 200 },
            canvas: canvasSchema,
          },
        },
      },
    },
    async (req): Promise<ApiResponse<EmbroideryProject>> => {
      const project = await projectsRepo.create({
        id: uuid(),
        ownerId: ownerId(req),
        name: req.body.name,
        canvas: req.body.canvas,
      });
      return { ok: true, data: project };
    }
  );

  // PUT /api/projects/:id — bodyLimit próprio: um projeto com vários
  // svgContent passa fácil do default de 1MB do Fastify; 12MB cobre projetos
  // grandes sem virar vetor de DoS (o rate limit global segura a frequência).
  app.put<{ Params: { id: string }; Body: UpdateProjectRequest }>(
    "/:id",
    { bodyLimit: 12 * 1024 * 1024 },
    async (req, reply): Promise<ApiResponse<EmbroideryProject>> => {
      const existing = await projectsRepo.get(req.params.id);
      if (!existing || existing.ownerId !== ownerId(req)) {
        reply.status(404);
        return { ok: false, error: "Project not found" };
      }
      const updated = await projectsRepo.update(req.params.id, req.body);
      return { ok: true, data: updated! };
    }
  );

  // DELETE /api/projects/:id
  app.delete<{ Params: { id: string } }>(
    "/:id",
    async (req, reply): Promise<ApiResponse<null>> => {
      const existing = await projectsRepo.get(req.params.id);
      if (!existing || existing.ownerId !== ownerId(req)) {
        reply.status(404);
        return { ok: false, error: "Project not found" };
      }
      await projectsRepo.remove(req.params.id);
      return { ok: true, data: null };
    }
  );

  // GET /api/projects/:id/versions — histórico (DATA-4)
  app.get<{ Params: { id: string } }>(
    "/:id/versions",
    async (req, reply): Promise<ApiResponse<projectsRepo.ProjectVersionMeta[]>> => {
      const existing = await projectsRepo.get(req.params.id);
      if (!existing || existing.ownerId !== ownerId(req)) {
        reply.status(404);
        return { ok: false, error: "Project not found" };
      }
      const versions = await projectsRepo.listVersions(req.params.id);
      return { ok: true, data: versions };
    }
  );

  // POST /api/projects/:id/versions/:versionId/restore — restaura uma versão antiga
  app.post<{ Params: { id: string; versionId: string } }>(
    "/:id/versions/:versionId/restore",
    async (req, reply): Promise<ApiResponse<EmbroideryProject>> => {
      const existing = await projectsRepo.get(req.params.id);
      if (!existing || existing.ownerId !== ownerId(req)) {
        reply.status(404);
        return { ok: false, error: "Project not found" };
      }
      const restored = await projectsRepo.restoreVersion(req.params.id, req.params.versionId);
      if (!restored) {
        reply.status(404);
        return { ok: false, error: "Version not found" };
      }
      return { ok: true, data: restored };
    }
  );
}
