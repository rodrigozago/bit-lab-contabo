import type { Metadata } from "next";
import { StoryblokStory } from "@storyblok/react/rsc";
import { fetchStory, fetchPublishedStories } from "@/lib/storyblok";
import { assertViewable, isIndexable } from "@/lib/access";
import type { PageStoryContent, ProjectStoryContent } from "@/lib/types";

type AnyStoryContent = PageStoryContent | ProjectStoryContent;

/** Catch-all pra qualquer página ou projeto criado no Storyblok — home
 * ("/") e a global "config" têm rota própria/uso próprio e não passam
 * por aqui. O componente certo (page ou project) é escolhido pelo
 * `StoryblokStory` com base em `content.component`, então uma única rota
 * cobre `/sobre`, `/contato`, `/projetos` e `/projetos/nome-do-projeto`. */
export async function generateStaticParams() {
  const stories = await fetchPublishedStories<AnyStoryContent>({
    excluding_slugs: "home,config",
  });

  return stories
    .filter((story) => story.content.visibility !== "private")
    .map((story) => ({ slug: story.full_slug.split("/") }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const story = await fetchStory<AnyStoryContent>(slug.join("/"));
  if (!story) return {};

  return {
    title: story.content.seo_title || story.content.title,
    description: story.content.seo_description,
    robots: isIndexable(story) ? undefined : { index: false, follow: false },
  };
}

export default async function CatchAllPage({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  const story = await fetchStory<AnyStoryContent>(slug.join("/"));
  assertViewable(story);

  return <StoryblokStory story={story} />;
}
