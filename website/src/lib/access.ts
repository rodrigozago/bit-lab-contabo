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
/** Normaliza o valor bruto que vem do Storyblok — editores já digitaram
 * "private " com espaço sobrando no campo (visto em produção), e o field
 * não garante um valor limpo. Comparação estrita depois disso. */
function normalizedVisibility(
  story: ISbStoryData<{ visibility?: Visibility }>,
): Visibility {
  const raw = story.content.visibility?.trim();
  return raw === "unlisted" || raw === "private" ? raw : "public";
}

export function assertViewable(
  story: ISbStoryData<{ visibility?: Visibility }> | null,
): asserts story is ISbStoryData<{ visibility?: Visibility }> {
  if (!story) notFound();
  if (normalizedVisibility(story) === "private") notFound();
}

export function isListed(
  story: ISbStoryData<{ visibility?: Visibility }>,
): boolean {
  return normalizedVisibility(story) === "public";
}

export function isIndexable(
  story: ISbStoryData<{ visibility?: Visibility }>,
): boolean {
  return normalizedVisibility(story) !== "unlisted";
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
  if (normalizedVisibility(story) === "private" && !session) {
    redirect(`/auth/login?returnTo=${encodeURIComponent(returnTo)}`);
  }
}
