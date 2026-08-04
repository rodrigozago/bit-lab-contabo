import { revalidateTag } from "next/cache";
import type { NextRequest } from "next/server";

/**
 * Webhook do Storyblok (story.published / story.unpublished) → aqui.
 * Cadastro em Settings → Webhooks, URL:
 *   https://bit-lab.tech/revalidate?secret=<STORYBLOK_WEBHOOK_SECRET>
 * Fora de /api/ de propósito — ver nginx/bit-lab.tech.conf.
 */
export async function POST(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get("secret");
  if (secret !== process.env.STORYBLOK_WEBHOOK_SECRET) {
    return new Response("Invalid token", { status: 401 });
  }

  // expire: 0 (em vez de profile: "max") porque isso é acionado por um
  // evento de publish do Storyblok — o conteúdo precisa aparecer na
  // próxima visita, não na "próxima depois da próxima" do stale-while-revalidate.
  revalidateTag("cms", { expire: 0 });
  return Response.json({ revalidated: true, now: Date.now() });
}
