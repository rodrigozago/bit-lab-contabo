import { CTA } from "./cta";
import { FAQ } from "./faq";
import { Features } from "./features";
import { Footer } from "./footer";
import { Hero } from "./hero";
import { Navbar } from "./navbar";
import { Pricing } from "./pricing";
import { Testimonials } from "./testimonials";
import { Video } from "./video";

export function LandingPage() {
  return (
    <main className="bg-background text-foreground min-h-screen w-full overflow-x-hidden">
      <Navbar />
      <Hero />
      <Features />
      <Video />
      <Testimonials />
      <Pricing />
      <FAQ />
      <CTA />
      <Footer />
    </main>
  );
}
