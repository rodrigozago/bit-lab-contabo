import { EllipsisVertical, LogOut } from "lucide-react"

import { useAuth } from "../lib/auth.ts"
import { useToast } from "./Toast.tsx"
import { Logo } from "@/components/logo"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"

/**
 * Footer da sidebar com o usuário logado (padrão do template) — religado à
 * auth real: dados do useAuth() e logout via SSO (mesmo fluxo do antigo UserMenu).
 */
export function NavUser() {
  const { isMobile } = useSidebar()
  const { me } = useAuth()
  const toast = useToast()

  async function handleLogout() {
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" })
      const data = await res.json()
      // Redireciona pro SSO logout, que depois volta pro app
      if (data.data?.ssoLogoutUrl) {
        window.location.href = data.data.ssoLogoutUrl
      } else {
        window.location.href = "/"
      }
    } catch {
      toast.error("Erro ao fazer logout")
    }
  }

  if (!me) return null

  const email = me.email || me.sub
  const displayName = email.split("@")[0]

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground cursor-pointer"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg">
                <Logo size={28} />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{displayName}</span>
                <span className="text-muted-foreground truncate text-xs">{email}</span>
              </div>
              <EllipsisVertical className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg">
                  <Logo size={28} />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{displayName}</span>
                  <span className="text-muted-foreground truncate text-xs">{email}</span>
                </div>
                {me.isAdmin && <Badge className="text-[10px] uppercase">Admin</Badge>}
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="cursor-pointer text-destructive focus:text-destructive"
              onClick={() => void handleLogout()}
            >
              <LogOut />
              Sair da conta
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
