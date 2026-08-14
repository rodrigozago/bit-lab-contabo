import type { Metadata } from "next";
import { Share_Tech_Mono, VT323 } from "next/font/google";
import "./opencdj.css";

// Layout ANINHADO (não root) — vive dentro de app/studio/, que já define
// <html>/<body> (studio/layout.tsx). Antes /opencdj era um root layout
// independente (domínio raiz, público); agora faz parte da área studio
// (SSO), então só aplica as fontes/identidade visual próprias num wrapper
// <div>, sem tentar abrir outro <html>. Ver opencdj.css: tokens (--cdj-*) e
// background/cor que antes viviam em :root/body agora estão em
// .opencdj-page, pra não vazar pro resto da área studio.
const shareTechMono = Share_Tech_Mono({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-mono",
});

const vt323 = VT323({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "Open CDJ · bit-lab",
  description: "Faça parte da nossa pista oculta.",
};

export default function OpencdjLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <div className={`${shareTechMono.variable} ${vt323.variable}`}>{children}</div>;
}
