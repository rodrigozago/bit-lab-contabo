import { storyblokEditable, StoryblokServerComponent } from "@storyblok/react/rsc";
import type { PageStoryContent } from "@/lib/types";

/** Blok raiz de qualquer `page`/`project` — só desenrola o array `body`.
 * Cada blok filho controla seu próprio tema (dark/light) e padding. */
export function Page({ blok }: { blok: PageStoryContent }) {
  return (
    <main {...storyblokEditable(blok)}>
      {blok.body?.map((nested) => (
        <StoryblokServerComponent blok={nested} key={nested._uid} />
      ))}
    </main>
  );
}
