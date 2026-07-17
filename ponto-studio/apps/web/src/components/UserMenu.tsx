import { LogOut, User } from "lucide-react";
import { useAuth } from "../lib/auth.ts";
import { useToast } from "./Toast.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";

export function UserMenu() {
  const { me } = useAuth();
  const toast = useToast();

  async function handleLogout() {
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      const data = await res.json();
      // Redireciona pro SSO logout, que depois volta pro app
      if (data.data?.ssoLogoutUrl) {
        window.location.href = data.data.ssoLogoutUrl;
      } else {
        window.location.href = "/";
      }
    } catch {
      toast.error("Erro ao fazer logout");
    }
  }

  if (!me) return null;

  const email = me.email || me.sub;
  const displayName = email.split("@")[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2 border-input bg-accent text-accent-foreground">
          <User className="h-4 w-4" />
          {displayName}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[200px]">
        <DropdownMenuLabel className="flex flex-col gap-1.5 font-normal">
          <span className="break-words text-xs text-muted-foreground">{email}</span>
          {me.isAdmin && <Badge className="w-fit bg-primary text-[10px] uppercase">Admin</Badge>}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => void handleLogout()}>
          <LogOut className="h-4 w-4" />
          Sair da conta
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
