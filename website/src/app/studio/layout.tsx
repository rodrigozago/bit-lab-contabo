import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./studio.css";

// Root layout independente (route group `studio/` — mesmo padrão de
// app/on-air/layout.tsx: Next 16 suporta múltiplos root layouts, cada um
// com <html>/<body> e CSS próprios). Alcançado via studio.bit-lab.tech,
// reescrito internamente por src/proxy.ts. noindex até a área sair do ar
// só pra usuários logados/convidados.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Studio · bit-lab",
  robots: { index: false, follow: false },
};

export default function StudioLayout({
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
