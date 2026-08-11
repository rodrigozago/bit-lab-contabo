import type { Metadata } from "next";
import { StoryblokStory } from "@storyblok/react/rsc";
import { fetchStory } from "@/lib/storyblok";
import { assertViewableInStudio, isIndexable } from "@/lib/access";
import { getStudioSession } from "@/lib/studio-session";
import type { PageStoryContent, ProjectStoryContent } from "@/lib/types";

type AnyStoryContent = PageStoryContent | ProjectStoryContent;

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
  const story = await fetchStory<AnyStoryContent>(`studio/${slug.join("/")}`);
  if (!story) return {};

  return {
    title: story.content.seo_title || story.content.title,
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
  const story = await fetchStory<AnyStoryContent>(`studio/${path}`);
  const session = await getStudioSession();
  assertViewableInStudio(story, session, `/${path}`);

  return <StoryblokStory story={story} />;
}
