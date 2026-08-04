import { draftMode } from "next/headers";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";

/**
 * Preview URL a cadastrar no Storyblok (Settings → Visual Editor):
 *   https://bit-lab.tech/preview?secret=<STORYBLOK_PREVIEW_SECRET>&slug={story.full_slug}
 *
 * Liga o draft mode do Next e manda o browser pra rota real da story —
 * é lá que o bridge do Storyblok assume e a edição ao vivo funciona.
 * Fora de /api/ de propósito: /api/ já é do opencdj-api na VPS
 * (ver nginx/bit-lab.tech.conf).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const secret = searchParams.get("secret");
  const slug = searchParams.get("slug");

  if (secret !== process.env.STORYBLOK_PREVIEW_SECRET) {
    return new Response("Invalid token", { status: 401 });
  }

  const draft = await draftMode();
  draft.enable();

  const path = !slug || slug === "home" ? "/" : `/${slug.replace(/^\/+/, "")}`;
  redirect(path);
}
