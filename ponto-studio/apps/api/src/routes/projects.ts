import type { FastifyInstance } from "fastify";
import { v4 as uuid } from "uuid";
import type {
  EmbroideryProject,
  CreateProjectRequest,
  UpdateProjectRequest,
  ApiResponse,
} from "@ponto-studio/shared";

// In-memory store — substituir por banco de dados na V2
export const store = new Map<string, EmbroideryProject>();

export async function projectsRoutes(app: FastifyInstance) {
  // GET /api/projects
  app.get("/", async (): Promise<ApiResponse<EmbroideryProject[]>> => {
    return { ok: true, data: Array.from(store.values()) };
  });

  // GET /api/projects/:id
  app.get<{ Params: { id: string } }>(
    "/:id",
    async (req, reply): Promise<ApiResponse<EmbroideryProject>> => {
      const project = store.get(req.params.id);
      if (!project) {
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
      if (!existing) {
        reply.status(404);
        return { ok: false, error: "Project not found" };
      }
      const updated: EmbroideryProject = {
        ...existing,
        ...req.body,
        id: existing.id,
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
      if (!store.has(req.params.id)) {
        reply.status(404);
        return { ok: false, error: "Project not found" };
      }
      store.delete(req.params.id);
      return { ok: true, data: null };
    }
  );
}
