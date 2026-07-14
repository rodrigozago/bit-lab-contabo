import type { ReactNode } from "react";

/**
 * Renderer de Markdown minimalista pro editorial do portfólio público.
 * Gera React nodes direto (sem HTML bruto / dangerouslySetInnerHTML), então
 * XSS é impossível por construção. Suporta: parágrafos, ## e ###, **negrito**,
 * *itálico* e [links](https://...) (só http/https).
 */

const INLINE_RE = /(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\((?:https?:\/\/)[^)\s]+\))/g;

function renderInline(text: string): ReactNode[] {
  return text.split(INLINE_RE).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    const link = /^\[([^\]]+)\]\(((?:https?:\/\/)[^)\s]+)\)$/.exec(part);
    if (link) {
      return (
        <a key={i} href={link[2]} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
          {link[1]}
        </a>
      );
    }
    return part;
  });
}

export function renderMarkdown(md: string): ReactNode[] {
  // blocos separados por linha em branco; quebra simples vira <br/> implícito do parágrafo
  return md
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block, i) => {
      if (block.startsWith("### ")) {
        return (
          <h3 key={i} className="font-serif text-xl">
            {renderInline(block.slice(4))}
          </h3>
        );
      }
      if (block.startsWith("## ")) {
        return (
          <h2 key={i} className="font-serif text-2xl">
            {renderInline(block.slice(3))}
          </h2>
        );
      }
      return (
        <p key={i} className="leading-relaxed">
          {renderInline(block.replace(/\n/g, " "))}
        </p>
      );
    });
}
