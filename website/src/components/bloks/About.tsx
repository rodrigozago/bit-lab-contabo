import Image from "next/image";
import { storyblokEditable, StoryblokServerRichText } from "@storyblok/react/rsc";
import type { StoryblokRichTextNode } from "@storyblok/react/rsc";
import type { AboutBlok } from "@/lib/types";
import { RevealText } from "@/components/motion/RevealText";
import { StaggerList } from "@/components/motion/StaggerList";

export function About({ blok }: { blok: AboutBlok }) {
  const theme = blok.theme ?? "dark";

  return (
    <section
      id="sobre"
      {...storyblokEditable(blok)}
      className={`theme--${theme} grid-12 py-24 md:py-32`}
    >
      {blok.eyebrow && (
        <p className="text-label col-span-12 mb-6 text-accent">{blok.eyebrow}</p>
      )}

      <RevealText as="h2" className="text-display col-span-12 mb-16 md:col-span-8">
        {blok.headline}
      </RevealText>

      {blok.photo?.filename && (
        <div className="relative col-span-12 mb-10 aspect-[4/3] overflow-hidden md:col-span-4 md:mb-0">
          <Image
            src={blok.photo.filename}
            alt={blok.photo.alt || blok.headline}
            fill
            className="object-cover"
          />
        </div>
      )}

      <div className="text-body col-span-12 max-w-2xl md:col-span-8">
        <StoryblokServerRichText
          doc={blok.bio as StoryblokRichTextNode<React.ReactElement>}
        />
      </div>

      {blok.pillars && blok.pillars.length > 0 && (
        <StaggerList className="grid-12 col-span-12 mt-20 gap-y-10">
          {blok.pillars.map((pillar) => (
            <div key={pillar._uid} className="col-span-12 md:col-span-6">
              <h3 className="text-label mb-3 text-accent">{pillar.title}</h3>
              {pillar.description && (
                <p className="text-body text-fg-muted">{pillar.description}</p>
              )}
            </div>
          ))}
        </StaggerList>
      )}
    </section>
  );
}
