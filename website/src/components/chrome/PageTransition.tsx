"use client";

import { usePathname } from "next/navigation";
import { useRef } from "react";
import { gsap, useGSAP } from "@/lib/gsap";

/** Overlay que varre a tela a cada troca de rota — cobre, a rota nova já
 * está montada por baixo, descobre. Puramente decorativo: não bloqueia
 * navegação nem SSR, roda só depois que o pathname muda. */
export function PageTransition() {
  const pathname = usePathname();
  const overlayRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!overlayRef.current) return;
      gsap
        .timeline()
        .set(overlayRef.current, { scaleY: 1, transformOrigin: "top" })
        .to(overlayRef.current, {
          scaleY: 0,
          transformOrigin: "bottom",
          duration: 0.6,
          ease: "power3.inOut",
        });
    },
    { dependencies: [pathname] },
  );

  return (
    <div
      ref={overlayRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-50 bg-accent"
      style={{ transform: "scaleY(0)" }}
    />
  );
}
