import type { FastifyInstance, FastifyRequest } from "fastify";
import { v4 as uuid } from "uuid";
import type {
  EmbroideryProject,
  CreateProjectRequest,
  UpdateProjectRequest,
  ApiResponse,
} from "@ponto-studio/shared";
import { readSession, type SessionUser } from "../services/session.js";

// In-memory store — substituir por banco de dados na V2
export const store = new Map<string, EmbroideryProject>();

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
    const mine = Array.from(store.values()).filter((p) => p.ownerId === ownerId(req));
    return { ok: true, data: mine };
  });

  // GET /api/projects/:id — 404 (não 403) se não for do dono, evita vazar existência
  app.get<{ Params: { id: string } }>(
    "/:id",
    async (req, reply): Promise<ApiResponse<EmbroideryProject>> => {
      const project = store.get(req.params.id);
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
      const now = new Date().toISOString();
      const project: EmbroideryProject = {
        id: uuid(),
        name: req.body.name,
        canvas: req.body.canvas,
        elements: [],
        ownerId: ownerId(req),
        createdAt: now,
        updatedAt: now,
      };
      store.set(project.id, project);
      return { ok: true, data: project };
    }
  );

  // PUT /api/projects/:id
  app.put<{ Params: { id: string }; Body: UpdateProjectRequest }>(
    "/:id",
    async (req, reply): Promise<ApiResponse<EmbroideryProject>> => {
      const existing = store.get(req.params.id);
      if (!existing || existing.ownerId !== ownerId(req)) {
        reply.status(404);
        return { ok: false, error: "Project not found" };
      }
      const updated: EmbroideryProject = {
        ...existing,
        ...req.body,
        id: existing.id,
        ownerId: existing.ownerId,
        updatedAt: new Date().toISOString(),
      };
      store.set(updated.id, updated);
      return { ok: true, data: updated };
    }
  );

  // DELETE /api/projects/:id
  app.delete<{ Params: { id: string } }>(
    "/:id",
    async (req, reply): Promise<ApiResponse<null>> => {
      const existing = store.get(req.params.id);
      if (!existing || existing.ownerId !== ownerId(req)) {
        reply.status(404);
        return { ok: false, error: "Project not found" };
      }
      store.delete(req.params.id);
      return { ok: true, data: null };
    }
  );
}
