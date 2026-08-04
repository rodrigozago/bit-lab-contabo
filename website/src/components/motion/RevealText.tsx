"use client";

import { useRef } from "react";
import { gsap, useGSAP, SplitText } from "@/lib/gsap";

/**
 * Headline que revela linha por linha ao entrar na viewport — o padrão
 * "MADE / WITH / CARE" do madewithgsap. Usa SplitText (grátis desde
 * abril/2025, ver src/lib/gsap.ts) pra quebrar em linhas e anima cada uma
 * com stagger.
 */
export function RevealText({
  as: Tag = "h2",
  className,
  children,
}: {
  as?: "h1" | "h2" | "h3" | "p";
  className?: string;
  children: string;
}) {
  const ref = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      if (!ref.current) return;
      const split = new SplitText(ref.current, { type: "lines" });

      gsap.set(split.lines, { yPercent: 110, opacity: 0 });
      gsap.to(split.lines, {
        yPercent: 0,
        opacity: 1,
        duration: 0.9,
        ease: "power3.out",
        stagger: 0.08,
        scrollTrigger: {
          trigger: ref.current,
          start: "top 85%",
        },
      });

      // useGSAP reverte animações/ScrollTriggers criados neste escopo
      // automaticamente no unmount — só o SplitText precisa de revert manual.
      return () => split.revert();
    },
    { scope: ref },
  );

  // Tag dinâmica (h1/h2/h3/p) — JSX trata `ref` como prop especial (não
  // entra no objeto de props), o que createElement(Tag, {ref, ...}) não
  // faz; por isso é JSX aqui, não createElement, apesar do Tag variável.
  switch (Tag) {
    case "h1":
      return (
        <h1 ref={ref as never} className={className} style={{ overflow: "hidden" }}>
          {children}
        </h1>
      );
    case "h3":
      return (
        <h3 ref={ref as never} className={className} style={{ overflow: "hidden" }}>
          {children}
        </h3>
      );
    case "p":
      return (
        <p ref={ref as never} className={className} style={{ overflow: "hidden" }}>
          {children}
        </p>
      );
    default:
      return (
        <h2 ref={ref as never} className={className} style={{ overflow: "hidden" }}>
          {children}
        </h2>
      );
  }
}
