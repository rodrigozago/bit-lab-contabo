"use client";

import { useRef } from "react";
import { gsap, useGSAP } from "@/lib/gsap";

/** Container genérico que anima os filhos diretos em cascata ao entrar na
 * viewport — usado pelo índice de projetos (01) (02) (03) e pelos grids
 * de feature. */
export function StaggerList({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!ref.current) return;
      gsap.from(ref.current.children, {
        y: 32,
        opacity: 0,
        duration: 0.7,
        ease: "power3.out",
        stagger: 0.1,
        scrollTrigger: {
          trigger: ref.current,
          start: "top 85%",
        },
      });
    },
    { scope: ref },
  );

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
