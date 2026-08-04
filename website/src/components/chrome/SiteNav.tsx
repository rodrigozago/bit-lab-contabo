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
          className="col-span-6 justify-self-end text-label md:hidden"
          aria-expanded={open}
          aria-controls="mobile-nav"
        >
          {open ? "Fechar" : "Menu"}
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
