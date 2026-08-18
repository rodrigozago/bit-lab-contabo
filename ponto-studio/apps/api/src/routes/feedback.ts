import type { FastifyInstance } from "fastify";
import type { ApiResponse } from "@ponto-studio/shared";
import { registerRequireSession } from "../services/requireSession.js";
import { lookupLocation } from "../services/geoip.js";
import { sendFeedback } from "../services/mailClient.js";

const FEEDBACK_TO = "rz@bit-lab.tech";
const MAX_MESSAGE_LENGTH = 4000;

interface FeedbackBody {
  message: string;
  browser?: {
    language?: string;
    timezone?: string;
    viewport?: string;
  };
}

export async function feedbackRoutes(app: FastifyInstance) {
  registerRequireSession(app);

  // POST /api/feedback — manda por e-mail (não persiste no banco por
  // enquanto, decisão do escopo inicial). Rate limit mais apertado que o
  // global (120/min): isso dispara e-mail de verdade, não é um recurso pra
  // martelar.
  app.post<{ Body: FeedbackBody }>(
    "/",
    { config: { rateLimit: { max: 5, timeWindow: "10 minutes" } } },
    async (req, reply): Promise<ApiResponse<null>> => {
      const message = (req.body?.message ?? "").trim();
      if (!message) {
        reply.status(400);
        return { ok: false, error: "Escreva uma mensagem antes de enviar." };
      }
      if (message.length > MAX_MESSAGE_LENGTH) {
        reply.status(400);
        return { ok: false, error: `Mensagem muito longa (máx. ${MAX_MESSAGE_LENGTH} caracteres).` };
      }

      const ip = req.ip;
      const location = lookupLocation(ip);
      const userAgent = req.headers["user-agent"];
      const { language, timezone, viewport } = req.body.browser ?? {};

      const result = await sendFeedback({
        message,
        appName: "Bordado Digital",
        account: { email: req.sessionUser!.email },
        location,
        browser: {
          ...(userAgent ? { userAgent } : {}),
          ...(language ? { language } : {}),
          ...(timezone ? { timezone } : {}),
          ...(viewport ? { viewport } : {}),
        },
        ip,
        to: FEEDBACK_TO,
      });

      if (!result.ok) {
        reply.status(502);
        return { ok: false, error: "Não consegui enviar o feedback agora — tente de novo em instantes." };
      }

      return { ok: true, data: null };
    }
  );
}
