import type { Metadata } from "next";
import { StoryblokStory } from "@storyblok/react/rsc";
import { fetchStory } from "@/lib/storyblok";
import { assertViewable } from "@/lib/access";
import type { PageStoryContent } from "@/lib/types";

export async function generateMetadata(): Promise<Metadata> {
  const story = await fetchStory<PageStoryContent>("home");
  if (!story) return {};
  return {
    title: story.content.seo_title || story.content.title,
    description: story.content.seo_description,
  };
}

export default async function HomePage() {
  const story = await fetchStory<PageStoryContent>("home");
  assertViewable(story);

  return <StoryblokStory story={story} />;
}
