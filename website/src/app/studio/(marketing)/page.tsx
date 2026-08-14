import type { Metadata } from "next";
import { StoryblokStory } from "@storyblok/react/rsc";
import { fetchStory } from "@/lib/storyblok";
import { assertViewableInStudio, isIndexable } from "@/lib/access";
import { getStudioSession } from "@/lib/studio-session";
import type { PageStoryContent } from "@/lib/types";

// Sem isso, o Next às vezes não detecta sozinho que a rota precisa ser
// dinâmica: getStudioSession() usa cookies() (API dinâmica), mas os bloks
// da página (LabelIndex, StudioCalendar) fazem fetch() cacheado — essa
// mistura, sem o bail-out explícito, derruba o render com
// DYNAMIC_SERVER_USAGE em produção (output: "standalone"). A página já
// depende da sessão por request, então "force-dynamic" só deixa explícito
// o que já era verdade.
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const story = await fetchStory<PageStoryContent>("studio");
  if (!story) return {};
  return {
    title: story.content.seo_title || story.content.title,
    description: story.content.seo_description,
    robots: isIndexable(story) ? undefined : { index: false, follow: false },
  };
}

export default async function StudioHomePage() {
  const story = await fetchStory<PageStoryContent>("studio");
  const session = await getStudioSession();
  assertViewableInStudio(story, session, "/");

  return <StoryblokStory story={story} />;
}
