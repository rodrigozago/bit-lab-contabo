import { useState } from "react";
import { LogOut, Menu } from "lucide-react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { api } from "@/api";
import { useAuth, loginUrl } from "@/lib/auth";
import { NotificationBell } from "@/components/NotificationBell";

function Brand() {
  return (
    <Link to="/" className="text-2xl font-extrabold tracking-tighter">
      FACE LAB
    </Link>
  );
}

// nav em caixa alta com underline no ativo (ref: image-refs/) — itens por papel
function MainNav({ onNavigate }: { onNavigate?: () => void }) {
  const { me } = useAuth();
  if (!me) return null;
  const isProducer = me.role === "producer" || me.role === "admin";

  const items = [
    { label: "Minhas Fotos", to: "/me" },
    { label: "Meu Rosto", to: "/enroll" },
    ...(isProducer ? [{ label: "Álbuns", to: "/producer" }] : []),
    ...(me.role === "admin" ? [{ label: "Admin", to: "/admin" }] : []),
  ];

  return (
    <nav className="flex flex-col gap-9">
      {items.map(({ label, to }) => (
        <NavLink
          key={to}
          to={to}
          onClick={onNavigate}
          className={({ isActive }) =>
            `w-fit text-[13px] uppercase tracking-widest transition-colors hover:text-foreground ${
              isActive ? "border-b border-foreground pb-1 text-foreground" : "text-neutral-500"
            }`
          }
        >
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

function UserFooter() {
  const { me } = useAuth();

  async function logout() {
    const r = await api<{ ssoLogoutUrl: string }>("/api/auth/logout", { method: "POST", body: JSON.stringify({}) });
    window.location.href = r.ssoLogoutUrl; // derruba o SSO no auth e volta
  }

  if (!me) {
    return (
      <Button asChild size="sm">
        <a href={loginUrl("/")}>Entrar</a>
      </Button>
    );
  }
  return (
    <div className="text-sm">
      <div className="truncate text-neutral-500" title={me.email}>
        {me.email}
      </div>
      <button
        type="button"
        onClick={logout}
        className="mt-2 inline-flex items-center gap-1.5 text-neutral-500 transition-colors hover:text-foreground"
      >
        <LogOut className="h-3.5 w-3.5" /> Sair
      </button>
      <div className="mt-4 flex gap-3 text-[11px] text-neutral-400">
        <Link to="/resources" className="hover:text-neutral-600">Documentação</Link>
        <Link to="/terms" className="hover:text-neutral-600">Termos</Link>
        <Link to="/privacy" className="hover:text-neutral-600">Privacidade</Link>
      </div>
    </div>
  );
}

export function AppLayout() {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen w-full bg-background">
      {/* Sidebar — desktop */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-60 lg:flex-col lg:justify-between lg:border-r">
        <div className="flex flex-col gap-y-20 p-8 pt-12">
          <div className="flex items-center justify-between">
            <Brand />
            <NotificationBell />
          </div>
          <MainNav />
        </div>
        <div className="p-8">
          <UserFooter />
        </div>
      </aside>

      {/* Header + drawer — mobile */}
      <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-background/95 px-4 backdrop-blur lg:hidden">
        <Brand />
        <div className="flex items-center">
          <NotificationBell />
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-6 w-6" />
                <span className="sr-only">Abrir menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="flex w-64 flex-col justify-between">
              <div className="flex flex-col gap-y-10">
                <SheetTitle className="sr-only">Menu</SheetTitle>
                <Brand />
                <MainNav onNavigate={() => setOpen(false)} />
              </div>
              <UserFooter />
            </SheetContent>
          </Sheet>
        </div>
      </header>

      {/* Conteúdo */}
      <main className="lg:pl-60">
        <div className="p-4 sm:p-6 lg:p-10">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
