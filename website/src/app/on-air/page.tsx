import type { Metadata } from "next";
import { StoryblokStory } from "@storyblok/react/rsc";
import { fetchStory } from "@/lib/storyblok";
import { assertViewable, isIndexable } from "@/lib/access";
import type { PageStoryContent } from "@/lib/types";

export async function generateMetadata(): Promise<Metadata> {
  const story = await fetchStory<PageStoryContent>("on-air");
  if (!story) return {};
  return {
    title: story.content.seo_title || story.content.title,
    description: story.content.seo_description,
    robots: isIndexable(story) ? undefined : { index: false, follow: false },
  };
}

export default async function OnAirPage() {
  const story = await fetchStory<PageStoryContent>("on-air");
  assertViewable(story);

  return <StoryblokStory story={story} />;
}
