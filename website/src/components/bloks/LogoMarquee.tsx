import Image from "next/image";
import { storyblokEditable } from "@storyblok/react/rsc";
import type { LogoMarqueeBlok } from "@/lib/types";
import { Marquee } from "@/components/motion/Marquee";

export function LogoMarquee({ blok }: { blok: LogoMarqueeBlok }) {
  const theme = blok.theme ?? "dark";

  return (
    <section
      {...storyblokEditable(blok)}
      className={`theme--${theme} py-16 md:py-24`}
    >
      {blok.heading && (
        <h2 className="text-label section-pad mb-10 text-fg-muted">
          {blok.heading}
        </h2>
      )}

      <Marquee>
        {blok.logos?.map((logo) =>
          logo.logo?.filename ? (
            <Image
              key={logo._uid}
              src={logo.logo.filename}
              alt={logo.logo.alt || logo.name}
              width={140}
              height={48}
              className="h-10 w-auto object-contain opacity-70"
            />
          ) : (
            <span key={logo._uid} className="text-label whitespace-nowrap">
              {logo.name}
            </span>
          ),
        )}
      </Marquee>
    </section>
  );
}
