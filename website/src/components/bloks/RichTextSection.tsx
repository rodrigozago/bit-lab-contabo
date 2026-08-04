import { storyblokEditable, StoryblokServerRichText } from "@storyblok/react/rsc";
import type { RichTextSectionBlok } from "@/lib/types";
import type { StoryblokRichTextNode } from "@storyblok/react/rsc";

export function RichTextSection({ blok }: { blok: RichTextSectionBlok }) {
  const theme = blok.theme ?? "dark";

  return (
    <section
      {...storyblokEditable(blok)}
      className={`theme--${theme} grid-12 py-16 md:py-24`}
    >
      <div className="text-body col-span-12 max-w-3xl md:col-span-8 prose-invert">
        <StoryblokServerRichText
          doc={blok.content as StoryblokRichTextNode<React.ReactElement>}
        />
      </div>
    </section>
  );
}
