"use client";

import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";

// GSAP 3.x + os plugins que eram do Club GreenSock (SplitText incluso) são
// 100% gratuitos pra uso comercial desde abril/2025 — sem licença a pagar.
// https://webflow.com/blog/gsap-becomes-free
if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger, SplitText, useGSAP);
}

export { gsap, useGSAP, ScrollTrigger, SplitText };
