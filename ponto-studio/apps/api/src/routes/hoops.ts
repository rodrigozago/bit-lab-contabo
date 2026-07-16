import type { FastifyInstance, FastifyRequest } from "fastify";
import { DEFAULT_HOOPS, type ApiResponse, type Hoop } from "@ponto-studio/shared";
import { readSession } from "../services/session.js";
import * as hoopsRepo from "../services/hoopsRepo.js";

function ownerId(req: FastifyRequest): string {
  return req.sessionUser!.sub;
}

const MIN_MM = 10;
const MAX_MM = 600;

export async function hoopsRoutes(app: FastifyInstance) {
  app.addHook("preHandler", async (req, reply) => {
    const user = await readSession(req);
    if (!user) {
      return reply.status(401).send({ ok: false, error: "não autenticado" });
    }
    req.sessionUser = user;
  });

  // GET /api/hoops — customizados do usuário + padrões (máquinas famosas)
  app.get("/", async (req): Promise<ApiResponse<{ custom: Hoop[]; defaults: Hoop[] }>> => {
    const custom = await hoopsRepo.listByOwner(ownerId(req));
    return { ok: true, data: { custom, defaults: DEFAULT_HOOPS } };
  });

  // POST /api/hoops — cria bastidor customizado
  app.post<{ Body: { name: string; widthMm: number; heightMm: number } }>(
    "/",
    async (req, reply): Promise<ApiResponse<Hoop>> => {
      const { name, widthMm, heightMm } = req.body ?? {};
      if (!name?.trim()) {
        reply.status(400);
        return { ok: false, error: "Nome do bastidor é obrigatório" };
      }
      for (const [label, v] of [["largura", widthMm], ["altura", heightMm]] as const) {
        if (typeof v !== "number" || !Number.isFinite(v) || v < MIN_MM || v > MAX_MM) {
          reply.status(400);
          return { ok: false, error: `${label} deve estar entre ${MIN_MM} e ${MAX_MM} mm` };
        }
      }
      const hoop = await hoopsRepo.create({
        ownerId: ownerId(req),
        name: name.trim(),
        widthMm,
        heightMm,
      });
      return { ok: true, data: hoop };
    }
  );

  // DELETE /api/hoops/:id — só o dono (o WHERE já garante)
  app.delete<{ Params: { id: string } }>(
    "/:id",
    async (req, reply): Promise<ApiResponse<null>> => {
      const removed = await hoopsRepo.remove(req.params.id, ownerId(req));
      if (!removed) {
        reply.status(404);
        return { ok: false, error: "Bastidor não encontrado" };
      }
      return { ok: true, data: null };
    }
  );
}
