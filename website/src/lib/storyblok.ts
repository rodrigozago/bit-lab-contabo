import "server-only";
import { draftMode } from "next/headers";
import { getStoryblokApi } from "@storyblok/react/rsc";
import type { ISbStoryData, ISbStoriesParams } from "@storyblok/react/rsc";
import "./storyblok-init";

/** Tag usada em toda fetch de conteúdo publicado — o webhook do Storyblok
 * (app/revalidate/route.ts) chama revalidateTag('cms') quando algo é
 * publicado/despublicado. */
const CMS_TAG = "cms";

async function resolveVersionAndToken() {
  const { isEnabled } = await draftMode();
  if (isEnabled) {
    return {
      isDraft: true as const,
      version: "draft" as const,
      token: process.env.STORYBLOK_PREVIEW_TOKEN,
    };
  }
  return {
    isDraft: false as const,
    version: "published" as const,
    token: process.env.NEXT_PUBLIC_STORYBLOK_PUBLIC_TOKEN,
  };
}

/** Busca uma story pelo full_slug (ex.: "home", "sobre", "projetos/foo").
 * Retorna null em 404 — quem chama decide se isso vira notFound(). */
export async function fetchStory<T extends object = object>(
  slug: string,
): Promise<ISbStoryData<T> | null> {
  const { isDraft, version, token } = await resolveVersionAndToken();
  const sbApi = getStoryblokApi();

  try {
    const { data } = await sbApi.getStory(
      slug,
      { version, token, resolve_links: "url" },
      isDraft ? { cache: "no-store" } : { next: { tags: [CMS_TAG] } },
    );
    return data.story as ISbStoryData<T>;
  } catch (error) {
    const status = (error as { status?: number })?.status;
    if (status === 404) return null;
    throw error;
  }
}

/** Lista stories, draft-aware — usado pelo `ProjectIndex` (renderiza a
 * cada request/revalidação, contexto onde draftMode() é permitido). */
export async function fetchStories<T extends object = object>(
  params: ISbStoriesParams,
): Promise<ISbStoryData<T>[]> {
  const { isDraft, version, token } = await resolveVersionAndToken();
  const sbApi = getStoryblokApi();

  const { data } = await sbApi.getStories(
    { version, token, ...params },
    isDraft ? { cache: "no-store" } : { next: { tags: [CMS_TAG] } },
  );
  return data.stories as ISbStoryData<T>[];
}

/** Variante sem draftMode() — só conteúdo publicado. Existe porque
 * `generateStaticParams` roda em build time, sem request, e o Next
 * proíbe chamar draftMode() ali (next-dynamic-api-wrong-context). Usada
 * também pelo sitemap, que não deve listar rascunhos de qualquer forma. */
export async function fetchPublishedStories<T extends object = object>(
  params: ISbStoriesParams,
): Promise<ISbStoryData<T>[]> {
  const sbApi = getStoryblokApi();
  const { data } = await sbApi.getStories(
    {
      version: "published",
      token: process.env.NEXT_PUBLIC_STORYBLOK_PUBLIC_TOKEN,
      ...params,
    },
    { next: { tags: [CMS_TAG] } },
  );
  return data.stories as ISbStoryData<T>[];
}
