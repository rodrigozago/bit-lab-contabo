import { createClient } from "redis";
import { config } from "./config.js";

export type RedisClient = ReturnType<typeof createClient>;

let client: RedisClient | null = null;

/** Cliente Redis compartilhado (sessão + state do OIDC) — conexão própria, separada da fila do worker. */
export async function getRedis(): Promise<RedisClient> {
  if (!client) {
    client = createClient({ url: config.redisUrl });
    client.on("error", (err: Error) => console.error("[redis] error:", err.message));
    await client.connect();
  }
  return client;
}
