"use client";

import { useRef } from "react";
import { gsap, useGSAP } from "@/lib/gsap";

/** Faixa horizontal em loop infinito — usada pelo LogoMarquee. Duplica o
 * conteúdo uma vez e anima -50% pra criar o efeito de laço sem costura. */
export function Marquee({
  className,
  speed = 40,
  children,
}: {
  className?: string;
  speed?: number;
  children: React.ReactNode;
}) {
  const trackRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!trackRef.current) return;
      const width = trackRef.current.scrollWidth / 2;
      gsap.to(trackRef.current, {
        x: -width,
        duration: width / speed,
        ease: "none",
        repeat: -1,
      });
    },
    { scope: trackRef, dependencies: [speed] },
  );

  return (
    <div className={`overflow-hidden ${className ?? ""}`}>
      <div ref={trackRef} className="flex w-max gap-16">
        <div className="flex shrink-0 gap-16">{children}</div>
        <div className="flex shrink-0 gap-16" aria-hidden="true">
          {children}
        </div>
      </div>
    </div>
  );
}
