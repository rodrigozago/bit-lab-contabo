import * as React from "react"
import { LayoutDashboard, Users, Rss, ScrollText } from "lucide-react"
import { Link } from "react-router-dom"

import { useAuth } from "../lib/auth.ts"
import { Logo } from "@/components/logo"
import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"

const mainGroup = {
  label: "Navegação",
  items: [{ title: "Dashboard", url: "/", icon: LayoutDashboard }],
}

const adminGroup = {
  label: "Administração",
  items: [
    { title: "Contas X", url: "/admin/twitter-accounts", icon: Users },
    { title: "Fontes de notícia", url: "/admin/news-sources", icon: Rss },
    { title: "Log de execuções", url: "/admin/scrape-logs", icon: ScrollText },
  ],
}

/**
 * Grupo "Administração" só renderiza pra quem é isAdmin (superuser central
 * do bit-lab), mesmo padrão do auth/web/src/components/app-sidebar.tsx —
 * não é um papel de tenant, é o mesmo gate que já protege /api/admin/*.
 */
export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const { me } = useAuth()

  return (
    <Sidebar collapsible="icon" variant="inset" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link to="/">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Logo size={24} className="text-current" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">Sentinela</span>
                  <span className="truncate text-xs">Monitoramento político</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain label={mainGroup.label} items={mainGroup.items} />
        {me?.isAdmin && <NavMain label={adminGroup.label} items={adminGroup.items} />}
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
