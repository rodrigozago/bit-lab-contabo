import { storyblokEditable } from "@storyblok/react/rsc";
import Link from "next/link";
import type { CtaBlok } from "@/lib/types";
import { resolveLinkHref } from "@/lib/links";
import { RevealText } from "@/components/motion/RevealText";

export function Cta({ blok }: { blok: CtaBlok }) {
  const theme = blok.theme ?? "dark";

  return (
    <section
      {...storyblokEditable(blok)}
      className={`theme--${theme} section-pad py-24 text-center md:py-40`}
    >
      <RevealText as="h2" className="text-display">
        {blok.headline}
      </RevealText>
      {blok.label && blok.link && (
        <Link
          href={resolveLinkHref(blok.link)}
          className="text-label mt-10 inline-block border-b border-accent pb-1"
        >
          {blok.label}
        </Link>
      )}
    </section>
  );
}
