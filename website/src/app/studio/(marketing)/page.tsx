import type { Metadata } from "next";
import { StoryblokStory } from "@storyblok/react/rsc";
import { fetchStory } from "@/lib/storyblok";
import { assertViewableInStudio, isIndexable } from "@/lib/access";
import { getStudioSession } from "@/lib/studio-session";
import type { PageStoryContent } from "@/lib/types";

export async function generateMetadata(): Promise<Metadata> {
  const story = await fetchStory<PageStoryContent>("studio", { noStore: true });
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
