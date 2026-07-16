import type { FastifyInstance, FastifyRequest } from "fastify";
import { v4 as uuid } from "uuid";
import type {
  EmbroideryProject,
  CreateProjectRequest,
  UpdateProjectRequest,
  ApiResponse,
} from "@ponto-studio/shared";
import { readSession, type SessionUser } from "../services/session.js";
import * as projectsRepo from "../services/projectsRepo.js";

declare module "fastify" {
  interface FastifyRequest {
    sessionUser?: SessionUser;
  }
}

function ownerId(req: FastifyRequest): string {
  return req.sessionUser!.sub;
}

export async function projectsRoutes(app: FastifyInstance) {
  // Projetos são dados sensíveis por usuário — exige sessão em todas as
  // rotas deste plugin (o gate no front já impede chegar aqui deslogado,
  // mas a API não deve confiar só nisso).
  app.addHook("preHandler", async (req, reply) => {
    const user = await readSession(req);
    if (!user) {
      return reply.status(401).send({ ok: false, error: "não autenticado" });
    }
    req.sessionUser = user;
  });

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

  // POST /api/projects
  app.post<{ Body: CreateProjectRequest }>(
    "/",
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

  // PUT /api/projects/:id
  app.put<{ Params: { id: string }; Body: UpdateProjectRequest }>(
    "/:id",
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
