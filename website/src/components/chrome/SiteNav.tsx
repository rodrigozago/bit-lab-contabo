"use client";

import { useState } from "react";
import Link from "next/link";
import { LocalClock } from "./LocalClock";
import { resolveLinkHref } from "@/lib/links";
import type { NavLink } from "@/lib/types";

export function SiteNav({ links }: { links: NavLink[] }) {
  const [open, setOpen] = useState(false);

  return (
    <header className="nav-blend fixed inset-x-0 top-0 z-40 text-fg">
      <div className="grid-12 items-center py-4">
        <Link
          href="/"
          className="col-span-6 text-label md:col-span-3"
          onClick={() => setOpen(false)}
        >
          bit-lab.tech
        </Link>

        <div className="col-span-3 hidden md:flex md:col-span-6 md:justify-center">
          <LocalClock />
        </div>

        <nav className="col-span-6 hidden justify-end gap-6 md:col-span-3 md:flex">
          {links.map((link) => (
            <Link
              key={link._uid}
              href={resolveLinkHref(link.link)}
              className="text-label"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="col-span-6 flex h-8 w-8 flex-col items-end justify-center justify-self-end gap-[5px] md:hidden"
          aria-expanded={open}
          aria-controls="mobile-nav"
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
        <nav
          id="mobile-nav"
          className="grid-12 gap-y-4 pb-6 md:hidden"
        >
          {links.map((link) => (
            <Link
              key={link._uid}
              href={resolveLinkHref(link.link)}
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
