import { useState } from "react";
import { NavLink, Outlet, Link } from "react-router-dom";
import { Menu, LogOut } from "lucide-react";
import { api } from "@/api";
import { useAuth, loginUrl } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

function Brand() {
  return (
    <Link to="/" className="text-2xl font-extrabold tracking-tighter text-foreground">
      FACE LAB<span className="text-muted-foreground">.</span>
    </Link>
  );
}

// nav em caixa alta com underline fino no ativo (ref: image-refs/)
function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  const { me } = useAuth();
  if (!me) return null;
  const isProducer = me.role === "producer" || me.role === "admin";

  const items = [
    { to: "/me", label: "Minhas fotos" },
    { to: "/enroll", label: "Meu rosto" },
    ...(isProducer ? [{ to: "/producer", label: "Álbuns" }] : []),
    ...(me.role === "admin" ? [{ to: "/admin", label: "Admin" }] : []),
  ];

  return (
    <nav className="flex flex-col gap-6">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              "w-fit text-[13px] uppercase tracking-widest transition-colors",
              isActive
                ? "border-b border-foreground pb-1 font-medium text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )
          }
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}

function UserFooter() {
  const { me } = useAuth();

  async function logout() {
    const r = await api<{ ssoLogoutUrl: string }>("/api/auth/logout", { method: "POST", body: JSON.stringify({}) });
    window.location.href = r.ssoLogoutUrl;
  }

  if (!me) {
    return (
      <Button asChild size="sm" className="w-fit">
        <a href={loginUrl("/")}>Entrar</a>
      </Button>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <span className="truncate text-[13px] text-muted-foreground" title={me.email}>
        {me.email}
      </span>
      <Button variant="ghost" size="sm" className="w-fit px-0 text-muted-foreground hover:bg-transparent hover:text-foreground" onClick={logout}>
        <LogOut /> Sair
      </Button>
    </div>
  );
}

export function AppLayout() {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-svh">
      {/* sidebar fixa — desktop */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col justify-between border-r bg-background px-8 py-10 lg:flex">
        <div>
          <Brand />
          <div className="mt-16">
            <NavItems />
          </div>
        </div>
        <UserFooter />
      </aside>

      {/* header + drawer — mobile */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b bg-background/95 px-5 py-4 backdrop-blur lg:hidden">
        <Brand />
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Abrir menu">
              <Menu className="!size-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="flex w-64 flex-col justify-between">
            <div>
              <SheetTitle className="sr-only">Menu</SheetTitle>
              <Brand />
              <div className="mt-12">
                <NavItems onNavigate={() => setOpen(false)} />
              </div>
            </div>
            <UserFooter />
          </SheetContent>
        </Sheet>
      </header>

      <main className="px-5 py-8 lg:pl-72 lg:pr-12 lg:py-12">
        <Outlet />
      </main>
    </div>
  );
}
