"use client";

import { useRef } from "react";
import { gsap, useGSAP } from "@/lib/gsap";

/** Desloca o conteúdo verticalmente em função do scroll — usado em
 * imagens de capa (hero, cards de projeto) pra dar profundidade sem
 * pesar no layout. */
export function Parallax({
  className,
  amount = 60,
  children,
}: {
  className?: string;
  amount?: number;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!ref.current) return;
      gsap.to(ref.current, {
        y: amount,
        ease: "none",
        scrollTrigger: {
          trigger: ref.current,
          start: "top bottom",
          end: "bottom top",
          scrub: true,
        },
      });
    },
    { scope: ref, dependencies: [amount] },
  );

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
