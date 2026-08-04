import "server-only";
import { fetchStory } from "./storyblok";
import type { ConfigStoryContent } from "./types";

/**
 * O menu é curado, não derivado da árvore de páginas: só entra aqui quem
 * foi listado na story global "config" (main_nav / footer_nav / socials).
 * Criar uma página no Storyblok publica a rota mas não a coloca no menu.
 */
export async function getSiteConfig(): Promise<ConfigStoryContent | null> {
  // Chamado pelo root layout — envolve toda página do site. Se a story
  // "config" falhar (token errado, Storyblok fora do ar), o chrome
  // degrada pra menu vazio em vez de derrubar o site inteiro; a página
  // de conteúdo em si (fetchStory da rota) continua falhando alto, como
  // deve ser quando o conteúdo real está faltando.
  try {
    const story = await fetchStory<ConfigStoryContent>("config");
    return story?.content ?? null;
  } catch (error) {
    console.error("[nav] falha ao buscar a story \"config\" do Storyblok:", error);
    return null;
  }
}
