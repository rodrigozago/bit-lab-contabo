/**
 * Extrai o SVG da resposta de um modelo de linguagem.
 *
 * O modelo deve devolver apenas SVG, mas na prática pode vir com markdown,
 * explicações ou truncado. Regras:
 *   - Se houver <svg>…</svg> completo, retorna esse trecho.
 *   - Se houver <svg> sem fechamento (resposta truncada), fecha a tag.
 *   - Se não houver <svg>, retorna null.
 */
export function extractSvg(text: string): string | null {
  const fullMatch = text.match(/<svg[\s\S]*<\/svg>/i);
  if (fullMatch) {
    return fullMatch[0];
  }
  const openMatch = text.match(/<svg[\s\S]*/i);
  if (openMatch) {
    return openMatch[0] + "\n</svg>";
  }
  return null;
}
