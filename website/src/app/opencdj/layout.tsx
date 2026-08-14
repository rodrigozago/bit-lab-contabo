import type { Metadata } from "next";
import { Share_Tech_Mono, VT323 } from "next/font/google";
import "./opencdj.css";

// Root layout independente (mesmo padrão de app/on-air/layout.tsx: Next 16
// suporta múltiplos root layouts, cada um com <html>/<body> e CSS próprios,
// sem SiteNav/SiteFooter). Ao contrário de studio/on-air, essa página É
// pública/divulgável — sem noindex.
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
  return (
    <html lang="pt-BR" className={`${shareTechMono.variable} ${vt323.variable}`}>
      <body>{children}</body>
    </html>
  );
}
