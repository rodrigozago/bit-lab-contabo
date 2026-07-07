import { createClient } from "redis";
import { config } from "./config.js";

export type RedisClient = ReturnType<typeof createClient>;

let client: RedisClient | null = null;

/** Cliente Redis compartilhado (sessões, rate limit, fila). */
export async function getRedis(): Promise<RedisClient> {
  if (!client) {
    client = createClient({ url: config.redisUrl });
    client.on("error", (err: Error) => console.error("[redis] error:", err.message));
    await client.connect();
  }
  return client;
}

/** Conexão dedicada pra pub/sub (não pode compartilhar com comandos normais). */
export async function newSubscriber(): Promise<RedisClient> {
  const sub = createClient({ url: config.redisUrl });
  sub.on("error", (err: Error) => console.error("[redis:sub] error:", err.message));
  await sub.connect();
  return sub;
}
