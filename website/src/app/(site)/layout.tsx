import type { Metadata } from "next";
import { Geist, Geist_Mono, Space_Grotesk } from "next/font/google";
import "../globals.css";
import "@/lib/storyblok-init";
import { SmoothScroll } from "@/components/chrome/SmoothScroll";
import { SiteNav } from "@/components/chrome/SiteNav";
import { SiteFooter } from "@/components/chrome/SiteFooter";
import { PageTransition } from "@/components/chrome/PageTransition";
import { Grain } from "@/components/chrome/Grain";
import { getSiteConfig } from "@/lib/nav";

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
  metadataBase: new URL("https://bit-lab.tech"),
  title: {
    default: "bit-lab.tech",
    template: "%s · bit-lab.tech",
  },
  description: "bit-lab — estúdio de produtos digitais e software sob medida.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const config = await getSiteConfig();

  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} ${spaceGrotesk.variable} scroll-smooth`}
    >
      <body className="bg-bg text-fg antialiased">
        <SmoothScroll>
          <PageTransition />
          <Grain />
          <SiteNav links={config?.main_nav ?? []} />
          {children}
          <SiteFooter
            footerLinks={config?.footer_nav ?? []}
            socials={config?.socials ?? []}
            contactEmail={config?.contact_email}
          />
        </SmoothScroll>
      </body>
    </html>
  );
}
