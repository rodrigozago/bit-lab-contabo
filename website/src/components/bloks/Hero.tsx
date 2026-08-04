import { storyblokEditable } from "@storyblok/react/rsc";
import type { HeroBlok } from "@/lib/types";
import { resolveLinkHref } from "@/lib/links";
import { RevealText } from "@/components/motion/RevealText";
import Link from "next/link";

export function Hero({ blok }: { blok: HeroBlok }) {
  const theme = blok.theme ?? "dark";

  return (
    <section
      {...storyblokEditable(blok)}
      className={`theme--${theme} grid-12 min-h-screen items-center pt-24`}
    >
      <div className="col-span-12">
        {blok.eyebrow && (
          <p className="text-label mb-6 text-accent">{blok.eyebrow}</p>
        )}
        <RevealText as="h1" className="text-display">
          {blok.headline}
        </RevealText>
        {blok.subline && (
          <p className="text-body mt-8 max-w-xl text-fg-muted">
            {blok.subline}
          </p>
        )}
        {blok.cta_label && blok.cta_link && (
          <Link
            href={resolveLinkHref(blok.cta_link)}
            className="text-label mt-10 inline-block border-b border-accent pb-1"
          >
            {blok.cta_label}
          </Link>
        )}
      </div>
    </section>
  );
}
