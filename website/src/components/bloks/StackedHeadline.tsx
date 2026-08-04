import { storyblokEditable } from "@storyblok/react/rsc";
import type { StackedHeadlineBlok } from "@/lib/types";
import { RevealText } from "@/components/motion/RevealText";

/** Headline empilhada palavra-por-linha — "MADE / WITH / CARE" do
 * madewithgsap. O quebra-linha vem do próprio conteúdo (editor insere
 * quebras de linha no campo `headline` no Storyblok). */
export function StackedHeadline({ blok }: { blok: StackedHeadlineBlok }) {
  const theme = blok.theme ?? "dark";

  return (
    <section
      {...storyblokEditable(blok)}
      className={`theme--${theme} section-pad py-24 md:py-40`}
    >
      <RevealText as="h2" className="text-display whitespace-pre-line text-center">
        {blok.headline}
      </RevealText>
    </section>
  );
}
