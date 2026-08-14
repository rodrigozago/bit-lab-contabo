import { StudioNav } from "./StudioNav";
import { StudioFooter } from "./StudioFooter";

/** Layout ANINHADO (não root — app/studio/layout.tsx continua sendo o único
 * <html>/<body> da área) que envolve só as páginas "de marketing" (landing +
 * catch-all genérico, ex. /labels/pista-oculta) com nav/footer. Route group
 * — o "(marketing)" não aparece na URL. /opencdj e /auth/* ficam FORA desse
 * grupo de propósito: já têm identidade visual própria (opencdj) ou são só
 * route handlers (auth), não devem ganhar esse chrome genérico. */
export default function StudioMarketingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <StudioNav />
      {children}
      <StudioFooter />
    </>
  );
}
