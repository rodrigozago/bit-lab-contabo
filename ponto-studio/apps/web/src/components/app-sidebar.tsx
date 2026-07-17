import * as React from "react"
import { FolderKanban } from "lucide-react"
import { Link } from "react-router-dom"
import type { CanvasSize } from "@ponto-studio/shared"

import { Logo } from "@/components/logo"
import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"

interface ProjectContext {
  name: string
  canvas: CanvasSize
}

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  /** Presente só no Editor — mostra nome do projeto e bastidor na sidebar. */
  projectContext?: ProjectContext
}

const navGroups = [
  {
    label: "Navegação",
    items: [
      {
        title: "Meus projetos",
        url: "/",
        icon: FolderKanban,
      },
    ],
  },
]

/**
 * Sidebar de navegação compartilhada entre as duas dashboards (Home e Editor),
 * no padrão do shadcn-dashboard-landing-template: header brandado, NavMain,
 * NavUser no footer, colapsável pra ícones com SidebarRail.
 */
export function AppSidebar({ projectContext, ...props }: AppSidebarProps) {
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
                  <span className="truncate font-medium">Ponto Studio</span>
                  <span className="truncate text-xs">Estúdio de bordado</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {navGroups.map((group) => (
          <NavMain key={group.label} label={group.label} items={group.items} />
        ))}

        {projectContext && (
          <SidebarGroup className="group-data-[collapsible=icon]:hidden">
            <SidebarGroupLabel>Projeto</SidebarGroupLabel>
            <SidebarGroupContent className="px-2 text-sm">
              <p className="truncate font-medium text-sidebar-foreground">{projectContext.name}</p>
              <p className="text-muted-foreground mt-0.5 text-xs">
                {Math.round(projectContext.canvas.widthMm)} × {Math.round(projectContext.canvas.heightMm)} mm
              </p>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
