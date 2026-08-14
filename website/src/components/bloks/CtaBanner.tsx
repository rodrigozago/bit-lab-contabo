import Image from "next/image";
import Link from "next/link";
import { storyblokEditable } from "@storyblok/react/rsc";
import type { CtaBannerBlok } from "@/lib/types";
import { resolveLinkHref } from "@/lib/links";
import { RevealText } from "@/components/motion/RevealText";

/** Banner CTA genérico — headline + CTA sobre uma imagem de fundo. Sem
 * nada específico de página embutido, pra reaproveitar em qualquer lugar
 * (site principal ou studio). */
export function CtaBanner({ blok }: { blok: CtaBannerBlok }) {
  const theme = blok.theme ?? "dark";

  return (
    <section
      {...storyblokEditable(blok)}
      className={`theme--${theme} relative flex min-h-[60vh] items-center justify-center overflow-hidden py-24 text-center`}
    >
      {blok.background_image?.filename && (
        <Image
          src={blok.background_image.filename}
          alt={blok.background_image.alt || blok.headline}
          fill
          className="object-cover"
        />
      )}
      <div className="bg-background/60 absolute inset-0" />

      <div className="relative z-10 px-6">
        <RevealText as="h2" className="text-display">
          {blok.headline}
        </RevealText>
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
