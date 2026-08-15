"use client";

import { useState } from "react";
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
  { href: "/curso-discotecagem", label: "Curso" },
  { href: "/#contato", label: "Contato" },
];

export function StudioNav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <div className="grid-12 items-center py-6">
        <Link
          href="/"
          className="col-span-6 text-label"
          onClick={() => setOpen(false)}
        >
          bit-lab studio
        </Link>

        <nav className="col-span-6 hidden flex-wrap justify-end gap-6 md:flex">
          {LINKS.slice(1).map((link) => (
            <Link key={link.href} href={link.href} className="text-label">
              {link.label}
            </Link>
          ))}
        </nav>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="col-span-6 flex h-8 w-8 flex-col items-end justify-center justify-self-end gap-[5px] md:hidden"
          aria-expanded={open}
          aria-controls="studio-mobile-nav"
          aria-label={open ? "Fechar menu" : "Abrir menu"}
        >
          <span
            className={`h-px w-6 bg-current transition-transform duration-200 ${
              open ? "translate-y-[3px] rotate-45" : ""
            }`}
          />
          <span
            className={`h-px w-6 bg-current transition-opacity duration-200 ${
              open ? "opacity-0" : "opacity-100"
            }`}
          />
          <span
            className={`h-px w-6 bg-current transition-transform duration-200 ${
              open ? "-translate-y-[3px] -rotate-45" : ""
            }`}
          />
        </button>
      </div>

      {open && (
        <nav id="studio-mobile-nav" className="grid-12 gap-y-4 pb-6 md:hidden">
          {LINKS.slice(1).map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-heading col-span-12"
              onClick={() => setOpen(false)}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
