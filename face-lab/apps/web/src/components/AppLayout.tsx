import { Menu } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

const navItems = [
  { label: "Minhas Fotos", to: "/me" },
  { label: "Meu Rosto", to: "/enroll" },
  { label: "Álbuns", to: "/producer" },
  { label: "Admin", to: "/admin" },
];

// Componente para a navegação, reutilizado no sidebar e no drawer
const MainNav = () => (
  <nav className="flex flex-col gap-2">
    {navItems.map(({ label, to }) => (
      <NavLink
        key={to}
        to={to}
        className={({ isActive }) =>
          `
          px-3 py-2 text-sm font-medium uppercase tracking-wider
          transition-colors hover:text-foreground
          ${isActive
            ? "text-foreground underline underline-offset-4"
            : "text-neutral-500"
          }
        `}
      >
        {label}
      </NavLink>
    ))}
  </nav>
);

import { Toaster } from "sonner";

export function AppLayout() {
  const userEmail = "user@facelab.com"; // Placeholder

  return (
    <div className="min-h-screen w-full bg-background">
      <Toaster richColors />
      {/* Sidebar para Desktop */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-60 lg:flex-col lg:border-r">
        <div className="flex flex-col gap-y-5 p-6">
          <div className="font-extrabold tracking-tighter text-xl">
            FACE LAB
          </div>
          <MainNav />
        </div>
        <div className="mt-auto p-6 text-sm">
          <div className="text-neutral-500">{userEmail}</div>
          <a href="/logout" className="mt-2 block text-neutral-500 hover:text-foreground">Sair</a>
        </div>
      </aside>

      {/* Header para Mobile */}
      <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-background px-4 lg:hidden">
        <div className="font-extrabold tracking-tighter text-xl">
          FACE LAB
        </div>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="h-6 w-6" />
              <span className="sr-only">Abrir menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left">
            <div className="flex flex-col gap-y-5 p-6">
              <div className="font-extrabold tracking-tighter text-xl">
                FACE LAB
              </div>
              <MainNav />
            </div>
            <div className="absolute bottom-0 left-0 w-full p-6 text-sm">
              <div className="text-neutral-500">{userEmail}</div>
               <a href="/logout" className="mt-2 block text-neutral-500 hover:text-foreground">Sair</a>
            </div>
          </SheetContent>
        </Sheet>
      </header>

      {/* Conteúdo Principal */}
      <main className="lg:pl-60">
        <div className="p-4 sm:p-6 lg:p-8">
            <Outlet />
        </div>
      </main>
    </div>
  );
}
