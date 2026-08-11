import "server-only";
import { notFound, redirect } from "next/navigation";
import type { ISbStoryData } from "@storyblok/react/rsc";
import type { Visibility } from "./types";
import type { StudioSession } from "./studio-session";

/**
 * Ponto único de decisão de visibilidade. `page` e `project` carregam um
 * campo `visibility` no Storyblok:
 *
 *   - "public"   → renderiza, indexa, entra no sitemap
 *   - "unlisted" → renderiza, mas noindex e fora do sitemap/generateStaticParams
 *   - "private"  → 404 por enquanto
 *
 * Quando a autenticação real (bit-lab-auth) chegar, é aqui — e só aqui —
 * que o caso "private" troca de notFound() para o gate OIDC.
 */
export function assertViewable(
  story: ISbStoryData<{ visibility?: Visibility }> | null,
): asserts story is ISbStoryData<{ visibility?: Visibility }> {
  if (!story) notFound();
  if (story.content.visibility === "private") notFound();
}

export function isListed(
  story: ISbStoryData<{ visibility?: Visibility }>,
): boolean {
  return (story.content.visibility ?? "public") === "public";
}

export function isIndexable(
  story: ISbStoryData<{ visibility?: Visibility }>,
): boolean {
  return (story.content.visibility ?? "public") !== "unlisted";
}

/**
 * Variante de `assertViewable` usada só dentro de studio.bit-lab.tech
 * (app/studio/**). Aqui é onde o comentário acima se realiza: `private`
 * não dá mais 404, exige sessão via SSO (auth.bit-lab.tech). `bit-lab.tech`
 * continua chamando `assertViewable` original, sem essa exceção.
 */
export function assertViewableInStudio(
  story: ISbStoryData<{ visibility?: Visibility }> | null,
  session: StudioSession | null,
  returnTo: string,
): asserts story is ISbStoryData<{ visibility?: Visibility }> {
  if (!story) notFound();
  if (story.content.visibility === "private" && !session) {
    redirect(`/auth/login?returnTo=${encodeURIComponent(returnTo)}`);
  }
}
