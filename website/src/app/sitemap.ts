import type { MetadataRoute } from "next";
import { fetchPublishedStories } from "@/lib/storyblok";
import { isListed } from "@/lib/access";
import type { PageStoryContent, ProjectStoryContent } from "@/lib/types";

const BASE_URL = "https://bit-lab.tech";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const stories = await fetchPublishedStories<PageStoryContent | ProjectStoryContent>({
    excluding_slugs: "config,opencdj-config",
  });

  const entries: MetadataRoute.Sitemap = stories
    .filter(isListed)
    .map((story) => ({
      url:
        story.full_slug === "home" ? BASE_URL : `${BASE_URL}/${story.full_slug}`,
      lastModified: story.published_at ?? story.created_at,
    }));

  return entries;
}
