import Link from "next/link";
import { resolveLinkHref } from "@/lib/links";
import type { NavLink } from "@/lib/types";

export function SiteFooter({
  footerLinks,
  socials,
  contactEmail,
}: {
  footerLinks: NavLink[];
  socials: NavLink[];
  contactEmail?: string;
}) {
  return (
    <footer className="theme--dark border-t border-border">
      <div className="grid-12 py-16">
        <p className="text-display col-span-12 mb-10">
          Vamos
          <br />
          Conversar
        </p>

        {contactEmail && (
          <a
            href={`mailto:${contactEmail}`}
            className="text-heading col-span-12 mb-10 underline decoration-accent underline-offset-8 md:col-span-8"
          >
            {contactEmail}
          </a>
        )}

        <nav className="col-span-12 flex flex-wrap gap-4 md:col-span-6">
          {footerLinks.map((link) => (
            <Link
              key={link._uid}
              href={resolveLinkHref(link.link)}
              className="text-label"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <nav className="col-span-12 mt-4 flex flex-wrap gap-4 md:col-span-6 md:mt-0 md:justify-end">
          {socials.map((link) => (
            <a
              key={link._uid}
              href={resolveLinkHref(link.link)}
              target="_blank"
              rel="noreferrer"
              className="text-label"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <p className="text-label col-span-12 mt-16 text-fg-muted">
          © {new Date().getFullYear()} bit-lab.tech
        </p>
      </div>
    </footer>
  );
}
