import type { FastifyInstance } from "fastify";
import { extractSvg } from "../services/svgExtractor.js";

interface AnalyzeResponse {
  svg: string;
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
