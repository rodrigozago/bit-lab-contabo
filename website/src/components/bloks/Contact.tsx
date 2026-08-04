import { storyblokEditable } from "@storyblok/react/rsc";
import type { ContactBlok } from "@/lib/types";
import { getSiteConfig } from "@/lib/nav";
import { resolveLinkHref } from "@/lib/links";
import { RevealText } from "@/components/motion/RevealText";

/** Auto-suficiente como o ProjectIndex: busca `socials` e faz fallback de
 * `email` na story global "config" em vez de duplicar esses dados num
 * campo próprio — `email`/`phone` no blok só servem pra sobrescrever
 * quando o contato desta seção precisa ser diferente do footer. */
export async function Contact({ blok }: { blok: ContactBlok }) {
  const theme = blok.theme ?? "dark";
  const config = await getSiteConfig();
  const email = blok.email || config?.contact_email;
  const socials = config?.socials ?? [];

  return (
    <section
      id="contato"
      {...storyblokEditable(blok)}
      className={`theme--${theme} section-pad py-24 md:py-32`}
    >
      <RevealText as="h2" className="text-display">
        {blok.heading}
      </RevealText>

      {blok.intro && (
        <p className="text-body mt-8 max-w-xl text-fg-muted">{blok.intro}</p>
      )}

      <div className="mt-12 flex flex-col gap-4">
        {email && (
          <a href={`mailto:${email}`} className="text-heading underline decoration-accent underline-offset-8">
            {email}
          </a>
        )}
        {blok.phone && (
          <a href={`tel:${blok.phone.replace(/[^\d+]/g, "")}`} className="text-heading">
            {blok.phone}
          </a>
        )}
      </div>

      {socials.length > 0 && (
        <nav className="mt-10 flex flex-wrap gap-6">
          {socials.map((social) => (
            <a
              key={social._uid}
              href={resolveLinkHref(social.link)}
              target="_blank"
              rel="noreferrer"
              className="text-label"
            >
              {social.label}
            </a>
          ))}
        </nav>
      )}
    </section>
  );
}
