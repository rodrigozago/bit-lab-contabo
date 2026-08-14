import Link from "next/link";

/** Nav fixo das páginas "de marketing" do studio (landing + labels) — links
 * hardcoded no código, não editável via Storyblok (mesmo espírito minimalista
 * do resto da área studio: nav do site principal É dinâmica via a story
 * "config", aqui não precisa desse nível de flexibilidade pra 5 links fixos).
 * "/opencdj" e "/auth/*" ficam fora do route group (marketing) de propósito,
 * então não recebem esse nav. */
const LINKS = [
  { href: "/", label: "Home" },
  { href: "/#sobre", label: "Sobre" },
  { href: "/#labels", label: "Labels" },
  { href: "/#calendario", label: "Calendário" },
  { href: "/#contato", label: "Contato" },
];

export function StudioNav() {
  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <nav className="grid-12 items-center py-6">
        <Link href="/" className="text-label col-span-6">
          bit-lab studio
        </Link>
        <div className="col-span-6 flex flex-wrap justify-end gap-6">
          {LINKS.slice(1).map((link) => (
            <Link key={link.href} href={link.href} className="text-label">
              {link.label}
            </Link>
          ))}
        </div>
      </nav>
    </header>
  );
}
