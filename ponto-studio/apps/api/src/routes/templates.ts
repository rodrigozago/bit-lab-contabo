import type { FastifyInstance } from "fastify";
import type { ApiResponse, DesignTemplate, PublishTemplateRequest } from "@ponto-studio/shared";
import { registerRequireSession, ownerId } from "../services/requireSession.js";
import { requireAdmin } from "../services/requireAdmin.js";
import * as templatesRepo from "../services/templatesRepo.js";
import * as projectsRepo from "../services/projectsRepo.js";

export async function templatesRoutes(app: FastifyInstance) {
  // Qualquer rota deste plugin exige sessão — inclusive GET (catálogo global,
  // mas só pra usuário logado, não anônimo).
  registerRequireSession(app);

  // GET /api/templates — catálogo inteiro, qualquer usuário logado vê
  app.get("/", async (): Promise<ApiResponse<DesignTemplate[]>> => {
    const templates = await templatesRepo.listAll();
    return { ok: true, data: templates };
  });

  // POST /api/templates — publica um projeto DO PRÓPRIO admin como matriz global
  app.post<{ Body: PublishTemplateRequest }>(
    "/",
    {
      preHandler: requireAdmin,
      schema: {
        body: {
          type: "object",
          required: ["projectId", "name"],
          additionalProperties: false,
          properties: {
            projectId: { type: "string", format: "uuid" },
            name: { type: "string", minLength: 1, maxLength: 200 },
          },
        },
      },
    },
    async (req, reply): Promise<ApiResponse<DesignTemplate>> => {
      const { projectId, name } = req.body;

      const project = await projectsRepo.get(projectId);
      // 404 (não 403) quando não é do dono — mesmo padrão de routes/projects.ts,
      // e aqui é o que garante que um admin só publica projeto PRÓPRIO: sem
      // essa checagem, um admin poderia vazar o conteúdo privado de outro
      // usuário pro catálogo público.
      if (!project || project.ownerId !== ownerId(req)) {
        reply.status(404);
        return { ok: false, error: "Project not found" };
      }

      const template = await templatesRepo.publishFromProject({
        createdBy: ownerId(req),
        name: name.trim(),
        canvas: project.canvas,
        elements: project.elements,
      });
      return { ok: true, data: template };
    }
  );

  // DELETE /api/templates/:id — remove do catálogo (qualquer admin, não só quem publicou)
  app.delete<{ Params: { id: string } }>(
    "/:id",
    { preHandler: requireAdmin },
    async (req, reply): Promise<ApiResponse<null>> => {
      const removed = await templatesRepo.remove(req.params.id);
      if (!removed) {
        reply.status(404);
        return { ok: false, error: "Matriz não encontrada" };
      }
      return { ok: true, data: null };
    }
  );
}
