import type { FastifyInstance } from "fastify";
import { createWriteStream, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { pipeline } from "stream/promises";
import { v4 as uuid } from "uuid";
import type { ApiResponse } from "@ponto-studio/shared";
import { registerRequireSession } from "../services/requireSession.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = join(__dirname, "..", "..", "uploads");
mkdirSync(UPLOADS_DIR, { recursive: true });

interface UploadResult {
  fileId: string;
  url: string;
  mimeType: string;
  originalName: string;
}

export async function uploadRoutes(app: FastifyInstance) {
  // Exige sessão: gravar arquivos de 10MB no servidor não pode ficar aberto
  // a anônimos (exaustão de disco).
  registerRequireSession(app);

  // POST /api/upload  — recebe PNG ou SVG. Rate limit apertado (grava 10MB/req).
  app.post(
    "/",
    { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } },
    async (req, reply): Promise<ApiResponse<UploadResult>> => {
      const data = await req.file();
      if (!data) {
        reply.status(400);
        return { ok: false, error: "No file provided" };
      }

      const allowed = ["image/png", "image/svg+xml"];
      if (!allowed.includes(data.mimetype)) {
        reply.status(400);
        return { ok: false, error: "Only PNG and SVG files are accepted" };
      }

      const ext = data.mimetype === "image/png" ? ".png" : ".svg";
      const fileId = uuid();
      const filename = `${fileId}${ext}`;
      const dest = join(UPLOADS_DIR, filename);

      await pipeline(data.file, createWriteStream(dest));

      const baseUrl = process.env["PUBLIC_URL"] ?? `http://localhost:${process.env["PORT"] ?? 3001}`;
      return {
        ok: true,
        data: {
          fileId,
          url: `${baseUrl}/uploads/${filename}`,
          mimeType: data.mimetype,
          originalName: data.filename,
        },
      };
    }
  );
}
