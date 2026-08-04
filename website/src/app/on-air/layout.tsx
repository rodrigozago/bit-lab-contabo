import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./onair.css";

// Root layout independente (route group `on-air/` fora de `(site)/`) — Next
// 16 suporta múltiplos root layouts assim, cada um com <html>/<body> e CSS
// próprios, sem nada compartilhado com o resto do site (sem SiteNav,
// SiteFooter, Grain, SmoothScroll — identidade Klein Blue própria, ver
// onair.css). Navegar entre este layout e o de (site)/ é full page load.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "On Air · bit-lab",
  description: "Quem está tocando agora.",
  robots: { index: false, follow: false },
};

export default function OnAirLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
