import { Menu } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import {
  Navbar as NavbarComponent,
  NavbarLeft,
  NavbarRight,
} from "@/components/ui/navbar";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const NAV_LINKS = [
  { text: "Recursos", href: "#recursos" },
  { text: "Como funciona", href: "#como-funciona" },
  { text: "Preços", href: "#precos" },
  { text: "FAQ", href: "#faq" },
];

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 -mb-4 px-4 pb-4">
      <div className="fade-bottom bg-background/15 absolute left-0 h-24 w-full backdrop-blur-lg"></div>
      <div className="max-w-container relative mx-auto">
        <NavbarComponent>
          <NavbarLeft>
            <a href="/" className="flex items-center gap-2 text-xl font-bold">
              <Logo size={28} variant="transparent" />
              Bordado Digital
            </a>
            <nav className="hidden items-center gap-6 md:flex">
              {NAV_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "text-muted-foreground hover:text-foreground text-sm font-medium transition-colors",
                  )}
                >
                  {link.text}
                </a>
              ))}
            </nav>
          </NavbarLeft>
          <NavbarRight>
            <a
              href="/app"
              className="text-foreground hidden text-sm font-medium md:block"
            >
              Entrar
            </a>
            <Button asChild>
              <a href="/app">Começar grátis</a>
            </Button>
            <Sheet>
              <SheetTrigger
                className={cn(
                  buttonVariants({ variant: "ghost", size: "icon" }),
                  "shrink-0 md:hidden",
                )}
              >
                <Menu className="size-5" />
                <span className="sr-only">Abrir menu</span>
              </SheetTrigger>
              <SheetContent side="right">
                <SheetTitle className="sr-only">Menu de navegação</SheetTitle>
                <nav className="grid gap-6 p-6 text-lg font-medium">
                  <a
                    href="/"
                    className="flex items-center gap-2 text-xl font-bold"
                  >
                    <Logo size={28} variant="transparent" />
                    Bordado Digital
                  </a>
                  {NAV_LINKS.map((link) => (
                    <a
                      key={link.href}
                      href={link.href}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      {link.text}
                    </a>
                  ))}
                  <a
                    href="/app"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    Entrar
                  </a>
                </nav>
              </SheetContent>
            </Sheet>
          </NavbarRight>
        </NavbarComponent>
      </div>
    </header>
  );
}
