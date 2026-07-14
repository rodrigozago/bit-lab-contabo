/**
 * Título em caixa alta com efeito de letreiro (marquee) rolando da esquerda
 * pra direita — hero das páginas públicas do portfólio. O texto real fica num
 * <h1> sr-only pra acessibilidade/SEO; as cópias visíveis são aria-hidden.
 * prefers-reduced-motion desliga a animação (ver index.css).
 */
export function MarqueeTitle({ text, className = "" }: { text: string; className?: string }) {
  const copies = Array.from({ length: 4 });
  return (
    <div className={`w-full overflow-hidden ${className}`}>
      <h1 className="sr-only">{text}</h1>
      <div aria-hidden className="marquee-track flex w-max">
        {copies.map((_, i) => (
          <span
            key={i}
            className="whitespace-nowrap pr-[0.6em] font-extrabold uppercase leading-none tracking-tighter"
          >
            {text}
          </span>
        ))}
      </div>
    </div>
  );
}
