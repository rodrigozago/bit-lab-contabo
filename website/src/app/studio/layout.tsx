import type { Metadata } from "next";
import { Geist, Geist_Mono, Space_Grotesk } from "next/font/google";
import "./studio.css";

// Root layout independente (route group `studio/` — mesmo padrão de
// app/on-air/layout.tsx: Next 16 suporta múltiplos root layouts, cada um
// com <html>/<body> e CSS próprios). Alcançado via studio.bit-lab.tech,
// reescrito internamente por src/proxy.ts.
//
// Mesmas fontes de app/(site)/layout.tsx (Geist Sans/Mono + Space Grotesk) —
// a landing pública do studio reaproveita os bloks do site principal
// (Hero, About, Cta...), que dependem dessas variáveis de fonte via
// globals.css. studio.css porta as mesmas classes utilitárias (ver lá).
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["500", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "Studio · bit-lab",
    template: "%s · bit-lab studio",
  },
  description: "bit-lab studio — espaço pra labels, coletivos e criadores.",
};

export default function StudioLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} ${spaceGrotesk.variable}`}
    >
      <body className="bg-background text-foreground antialiased">{children}</body>
    </html>
  );
}
