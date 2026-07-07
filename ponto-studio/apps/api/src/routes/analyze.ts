import type { FastifyInstance } from "fastify";
import { createWriteStream, mkdirSync, readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { pipeline } from "stream/promises";
import { v4 as uuid } from "uuid";
import type { AnalyzeJobStatus, LocalAnalyzeParams } from "@ponto-studio/shared";
import { extractSvg } from "../services/svgExtractor.js";
import { enqueueAnalyzeJob, getJob } from "../services/jobQueue.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = join(__dirname, "..", "..", "uploads");
const EXPORTS_DIR = join(__dirname, "..", "..", "exports");
mkdirSync(UPLOADS_DIR, { recursive: true });

interface AnalyzeResponse {
  svg: string;
}

/** Lê um field de multipart como número, com default. */
function fieldNumber(fields: Record<string, unknown>, name: string, fallback: number): number {
  const field = fields[name] as { value?: string } | undefined;
  const parsed = field?.value !== undefined ? Number(field.value) : NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

const USER_PROMPT = `You are an embroidery design assistant. Analyze this image and generate a clean SVG file suitable for machine embroidery using Ink/Stitch.

Rules for the SVG:
- Use only solid colors (no gradients, no opacity, no blur)
- Each distinct region must be a separate <path> element with a unique fill color
- Paths must be closed (z at the end of the d attribute)
- Simplify shapes — embroidery needs clean, not detailed curves
- Add inkstitch attributes to each path:
  - inkstitch:fill_method="tatami" for large filled areas
  - inkstitch:fill_method="satin_column" for narrow/border areas
  - inkstitch:density_mm="0.4" for normal density
- Use a viewBox matching the original image proportions
- Return ONLY the raw SVG code, no explanation, no markdown`;

export async function analyzeRoutes(app: FastifyInstance) {
  // POST /api/analyze/local — análise por processamento digital (sem IA).
  // Salva a imagem em uploads/ (volume compartilhado com o worker) e enfileira
  // um job type:"analyze". O front acompanha via GET /local/:jobId.
  app.post("/local", async (req, reply) => {
    const data = await req.file();
    if (!data) {
      return reply.status(400).send({ ok: false, error: "No file uploaded" });
    }
    if (!["image/png", "image/jpeg"].includes(data.mimetype)) {
      return reply.status(400).send({ ok: false, error: "Only PNG and JPEG are accepted" });
    }

    const jobId = uuid();
    const ext = data.mimetype === "image/png" ? ".png" : ".jpg";
    const imageFile = `${jobId}${ext}`;
    await pipeline(data.file, createWriteStream(join(UPLOADS_DIR, imageFile)));

    const analyzeParams: LocalAnalyzeParams = {
      colors: fieldNumber(data.fields, "colors", 4),
      minRegionPct: fieldNumber(data.fields, "minRegionPct", 0.1),
      detail: fieldNumber(data.fields, "detail", 2),
    };

    await enqueueAnalyzeJob({ jobId, imageFile, analyzeParams });
    return reply.send({ ok: true, data: { jobId } });
  });

  // GET /api/analyze/local/:jobId — status do job; quando done, devolve o SVG
  app.get<{ Params: { jobId: string } }>("/local/:jobId", async (req, reply) => {
    const job = getJob(req.params.jobId);
    if (!job) {
      return reply.status(404).send({ ok: false, error: "Job not found" });
    }

    const status: AnalyzeJobStatus = {
      jobId: job.jobId,
      status: job.status,
      ...(job.errorMessage ? { errorMessage: job.errorMessage } : {}),
    };

    if (job.status === "done") {
      const svgPath = join(EXPORTS_DIR, `${job.jobId}.svg`);
      if (!existsSync(svgPath)) {
        return reply.status(500).send({ ok: false, error: "Result file missing" });
      }
      status.svg = readFileSync(svgPath, "utf-8");
    }

    return reply.send({ ok: true, data: status });
  });

  app.post<{ Reply: AnalyzeResponse | { error: string } }>("/", async (req, reply) => {
    const apiKey = process.env["OPENROUTER_API_KEY"];
    if (!apiKey) {
      return reply.status(500).send({ error: "OPENROUTER_API_KEY not configured" });
    }

    const data = await req.file();
    if (!data) {
      return reply.status(400).send({ error: "No file uploaded" });
    }

    const chunks: Buffer[] = [];
    for await (const chunk of data.file) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);
    const base64 = buffer.toString("base64");
    const mimeType = data.mimetype || "image/png";

    const body = {
      model: "openrouter/auto",
      messages: [
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } },
            { type: "text", text: USER_PROMPT },
          ],
        },
      ],
      temperature: 0.2,
      max_tokens: 8192,
    };

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://ponto-studio.local",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      app.log.error({ status: res.status, text }, "OpenRouter API error");
      return reply.status(502).send({ error: `OpenRouter error: ${res.status}` });
    }

    const groqData = await res.json() as { choices: Array<{ message: { content: string } }> };
    const text = groqData.choices[0]?.message?.content ?? "";

    // Extrai SVG — se truncado, fecha a tag para não quebrar o render
    const svg = extractSvg(text);
    if (!svg) {
      app.log.error({ text }, "Response did not contain SVG");
      return reply.status(502).send({ error: "Model did not return a valid SVG" });
    }

    return reply.send({ svg });
  });
}
