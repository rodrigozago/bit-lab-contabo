// Sem "server-only" de propósito — resolveLinkHref é usado tanto por
// server components (Hero, Cta, SiteFooter) quanto pelo client component
// SiteNav (que precisa re-renderizar o menu no toggle mobile).
import type { NavLink } from "./types";

export function resolveLinkHref(link: NavLink["link"]): string {
  if (!link) return "/";
  if (link.linktype === "url") return link.cached_url ?? "/";
  const slug = link.cached_url ?? "";
  if (slug === "home") return "/";
  return `/${slug}`;
}
