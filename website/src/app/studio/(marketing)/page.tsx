import type { Metadata } from "next";
import { StoryblokStory } from "@storyblok/react/rsc";
import { fetchStory } from "@/lib/storyblok";
import { assertViewableInStudio, isIndexable } from "@/lib/access";
import { getStudioSession } from "@/lib/studio-session";
import type { PageStoryContent } from "@/lib/types";

export async function generateMetadata(): Promise<Metadata> {
  // Sem noStore aqui de propósito: generateMetadata não usa cookies(), então
  // não há API de request pra "justificar" dinamismo pro Next — forçar
  // no-store só nessa função (sem nenhum outro sinal dinâmico por perto) foi
  // o que quebrava a geração estática no build. Metadata cacheada é aceitável
  // (revalida via webhook do Storyblok, mesmo padrão do resto do site).
  const story = await fetchStory<PageStoryContent>("studio");
  if (!story) return {};
  return {
    title: story.content.seo_title || story.content.title,
    description: story.content.seo_description,
    robots: isIndexable(story) ? undefined : { index: false, follow: false },
  };
}

export default async function StudioHomePage() {
  const story = await fetchStory<PageStoryContent>("studio", { noStore: true });
  const session = await getStudioSession();
  assertViewableInStudio(story, session, "/");

  return <StoryblokStory story={story} />;
}
