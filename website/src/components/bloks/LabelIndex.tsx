import Link from "next/link";
import Image from "next/image";
import { storyblokEditable } from "@storyblok/react/rsc";
import type { LabelIndexBlok, LabelStoryContent } from "@/lib/types";
import { fetchStories } from "@/lib/storyblok";
import { isListed } from "@/lib/access";
import { StaggerList } from "@/components/motion/StaggerList";

/** Vitrine dos labels do studio — mesmo padrão de self-fetch do
 * ProjectIndex.tsx (content_type + starts_with, filtra isListed). Diferença
 * importante: full_slug vem prefixado "studio/..." (convenção da área
 * studio), mas o link precisa ser relativo a studio.bit-lab.tech — por isso
 * remove o prefixo "studio/" do href, ao contrário do ProjectIndex (que
 * linka full_slug direto porque o site principal É a raiz do domínio). */
export async function LabelIndex({ blok }: { blok: LabelIndexBlok }) {
  const theme = blok.theme ?? "dark";
  const stories = await fetchStories<LabelStoryContent>(
    { content_type: "label", starts_with: "studio/labels/" },
    { noStore: true },
  );
  const listed = stories.filter(isListed);

  return (
    <section
      id="labels"
      {...storyblokEditable(blok)}
      className={`theme--${theme} section-pad py-24 md:py-32`}
    >
      {blok.heading && <h2 className="text-heading mb-16">{blok.heading}</h2>}

      <StaggerList className="grid-12 gap-y-10">
        {listed.map((story) => (
          <Link
            key={story.uuid}
            href={`/${story.full_slug.replace(/^studio\//, "")}`}
            className="group col-span-12 flex items-center gap-6 border-b border-border py-8 md:col-span-6"
          >
            {story.content.photo?.filename && (
              <div className="relative h-20 w-20 shrink-0 overflow-hidden">
                <Image
                  src={story.content.photo.filename}
                  alt={story.content.photo.alt || story.content.name}
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
              </div>
            )}
            <div>
              <p className="text-heading">{story.content.name}</p>
              {story.content.tagline && (
                <p className="text-label mt-1 text-fg-muted">{story.content.tagline}</p>
              )}
            </div>
          </Link>
        ))}
      </StaggerList>

      {listed.length === 0 && (
        <p className="text-body text-fg-muted">Em breve.</p>
      )}
    </section>
  );
}
