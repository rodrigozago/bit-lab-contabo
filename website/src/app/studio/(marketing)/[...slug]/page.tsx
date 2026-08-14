import type { Metadata } from "next";
import { StoryblokStory } from "@storyblok/react/rsc";
import { fetchStory } from "@/lib/storyblok";
import { assertViewableInStudio, isIndexable } from "@/lib/access";
import { getStudioSession } from "@/lib/studio-session";
import type { PageStoryContent, ProjectStoryContent, LabelStoryContent } from "@/lib/types";

type AnyStoryContent = PageStoryContent | ProjectStoryContent | LabelStoryContent;

/** Catch-all pra qualquer página criada no Storyblok dentro da área studio
 * (slug prefixado "studio/..."). Mesmo padrão do (site)/[...slug]/page.tsx,
 * mas sem `generateStaticParams`: páginas privadas dependem da sessão da
 * request (cookie), não dá pra pré-gerar estaticamente sem vazar entre
 * usuários. "studio" (home) e "studio/auth/*" (rotas OIDC) ficam de fora —
 * home tem rota própria em app/studio/page.tsx, auth/* são route handlers. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const story = await fetchStory<AnyStoryContent>(`studio/${slug.join("/")}`, { noStore: true });
  if (!story) return {};

  // "title" existe em page/project; "label" tem "name" no lugar — sem campo
  // comum entre os três, resolve o fallback dinamicamente. SbBlokData tem
  // index signature própria (SbBlokKeyDataTypes), então o acesso direto não
  // garante string — coage explicitamente.
  const rawTitle =
    "title" in story.content ? story.content.title : story.content.name;
  const fallbackTitle = typeof rawTitle === "string" ? rawTitle : undefined;

  return {
    title: story.content.seo_title || fallbackTitle,
    description: story.content.seo_description,
    robots: isIndexable(story) ? undefined : { index: false, follow: false },
  };
}

export default async function StudioCatchAllPage({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  const path = slug.join("/");
  const story = await fetchStory<AnyStoryContent>(`studio/${path}`, { noStore: true });
  const session = await getStudioSession();
  assertViewableInStudio(story, session, `/${path}`);

  return <StoryblokStory story={story} />;
}
