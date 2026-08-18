import Fastify from "fastify";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { sendRoutes } from "./routes/send.js";

const PORT = Number(process.env.PORT || 4000);

const app = Fastify({ logger: { level: "info" } });

// Sem CSP (não serve HTML pra navegador, só JSON) — mesma decisão do resto
// dos serviços do repo, aqui nem se aplica de verdade.
await app.register(helmet, { contentSecurityPolicy: false });

// Rate limit global — cada envio custa cota no Resend e pode queimar
// reputação de domínio se abusado; mais apertado que os outros serviços
// porque isso não é uma API de uso normal do usuário final, só serviço-a-serviço.
await app.register(rateLimit, { global: true, max: 60, timeWindow: "1 minute", allowList: (req) => req.url === "/health" });

app.get("/health", async () => ({ ok: true, service: "bit-lab-email" }));

await app.register(sendRoutes);

app.listen({ port: PORT, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
