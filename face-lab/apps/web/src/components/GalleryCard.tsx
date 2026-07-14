import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

/**
 * Card de galeria estilo Zentiq: imagem full-bleed em retrato, badge de
 * categoria no topo-esquerdo e título serif (Playfair) sobre a foto,
 * ancorado embaixo com scrim pra legibilidade.
 */
export function GalleryCard({
  image,
  badge,
  title,
  subtitle,
  className = "",
  children,
}: {
  image?: string | null;
  badge?: string;
  title: string;
  subtitle?: string;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div className={`group relative aspect-[2/3] w-full overflow-hidden rounded-none bg-secondary ${className}`}>
      {image && (
        <img
          src={image}
          alt={title}
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />
      )}
      {/* scrim inferior — legibilidade do título sobre qualquer foto */}
      <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/70 to-transparent" />

      {badge && (
        <Badge className="absolute left-4 top-4 bg-accent text-accent-foreground hover:bg-accent">{badge}</Badge>
      )}

      <div className="absolute inset-x-0 bottom-0 p-5">
        <p className="font-serif text-3xl leading-tight text-white sm:text-4xl">{title}</p>
        {subtitle && <p className="mt-1 text-sm text-white/80">{subtitle}</p>}
        {children}
      </div>
    </div>
  );
}

/** Card CTA — fundo ouro sólido, título serif escuro e botão pill (ref Zentiq). */
export function GalleryCtaCard({
  title,
  ctaLabel,
  onCtaClick,
  href,
  className = "",
}: {
  title: string;
  ctaLabel: string;
  onCtaClick?: () => void;
  href?: string;
  className?: string;
}) {
  return (
    <div className={`flex aspect-[2/3] w-full flex-col justify-center rounded-none bg-accent p-8 ${className}`}>
      <p className="font-serif text-3xl leading-tight text-accent-foreground sm:text-4xl">{title}</p>
      <div className="mt-6">
        {href ? (
          <Button asChild className="px-6">
            <a href={href}>{ctaLabel} ↗</a>
          </Button>
        ) : (
          <Button className="px-6" onClick={onCtaClick}>
            {ctaLabel} ↗
          </Button>
        )}
      </div>
    </div>
  );
}
