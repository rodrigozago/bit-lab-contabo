import Link from "next/link";
import Image from "next/image";
import { storyblokEditable } from "@storyblok/react/rsc";
import type { ProjectIndexBlok, ProjectStoryContent } from "@/lib/types";
import { fetchStories } from "@/lib/storyblok";
import { isListed } from "@/lib/access";
import { StaggerList } from "@/components/motion/StaggerList";

/** Índice numerado de projetos — "(01) (02) (03)" do 2xa.studio. Busca as
 * stories do content_type "project" direto (server component async),
 * filtrando as `private`/`unlisted` — o índice só é vitrine, projetos
 * fora do menu principal ainda existem em /projetos/[slug]. */
export async function ProjectIndex({ blok }: { blok: ProjectIndexBlok }) {
  const theme = blok.theme ?? "dark";
  const stories = await fetchStories<ProjectStoryContent>({
    content_type: "project",
    starts_with: "projetos/",
    sort_by: "position:asc",
  });
  const listed = stories.filter(isListed);

  return (
    <section
      {...storyblokEditable(blok)}
      className={`theme--${theme} section-pad py-24 md:py-32`}
    >
      {blok.heading && (
        <h2 className="text-heading mb-16">{blok.heading}</h2>
      )}

      <StaggerList className="flex flex-col divide-y divide-border">
        {listed.map((story, i) => (
          <Link
            key={story.uuid}
            href={`/${story.full_slug}`}
            className="group grid grid-cols-12 items-center gap-4 py-8"
          >
            <span className="text-label col-span-2 text-fg-muted md:col-span-1">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="text-heading col-span-7 md:col-span-8">
              {story.content.title ?? story.name}
            </span>
            {story.content.cover?.filename ? (
              <div className="relative col-span-3 aspect-video overflow-hidden md:col-span-3">
                <Image
                  src={story.content.cover.filename}
                  alt={story.content.cover.alt || story.content.title || ""}
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
              </div>
            ) : (
              <span className="text-label col-span-3 text-right text-fg-muted md:col-span-3">
                {story.content.year}
              </span>
            )}
          </Link>
        ))}
      </StaggerList>
    </section>
  );
}
