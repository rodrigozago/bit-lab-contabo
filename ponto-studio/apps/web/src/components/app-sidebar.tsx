import * as React from "react"
import { FolderKanban, ImageUp, Type as TypeIcon, Download, History as HistoryIcon, Trash2 } from "lucide-react"
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

/**
 * Ações de projeto do Editor (Fase 7 — antes viviam nos grupos "Arquivo"/
 * "Editar" da sidebar DIREITA; migraram pra cá pra sidebar direita ficar só
 * com Propriedades + Partes). Os handlers/modais continuam no Editor.
 */
export interface ProjectActions {
  onImportImage: () => void
  onAddText: () => void
  onExport: () => void
  onHistory: () => void
  onDeleteProject: () => void
  deleting: boolean
}

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  /** Presente só no Editor — mostra nome do projeto e bastidor na sidebar. */
  projectContext?: ProjectContext
  /** Presente só no Editor — grupos Arquivo/Editar abaixo do bloco Projeto. */
  projectActions?: ProjectActions
}

const navGroups = [
  {
    label: "Navegação",
    items: [
      {
        title: "Meus projetos",
        url: "/app",
        icon: FolderKanban,
      },
    ],
  },
]

/**
 * Sidebar de navegação compartilhada entre as duas dashboards (Home e Editor),
 * no padrão do shadcn-dashboard-landing-template: header brandado, NavMain,
 * NavUser no footer, colapsável pra ícones com SidebarRail. No Editor, também
 * carrega o bloco "Projeto" e os grupos Editar/Arquivo (via projectActions).
 */
export function AppSidebar({ projectContext, projectActions, ...props }: AppSidebarProps) {
  return (
    <Sidebar collapsible="icon" variant="inset" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link to="/app">
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

        {projectActions && (
          <>
            <SidebarGroup>
              <SidebarGroupLabel>Editar</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton onClick={projectActions.onImportImage} tooltip="Importar imagem">
                      <ImageUp /> <span>Importar imagem</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton onClick={projectActions.onAddText} tooltip="Adicionar texto">
                      <TypeIcon /> <span>Adicionar texto</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton onClick={projectActions.onExport} tooltip="Exportar bordado">
                      <Download /> <span>Exportar bordado</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup>
              <SidebarGroupLabel>Arquivo</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton onClick={projectActions.onHistory} tooltip="Histórico do projeto">
                      <HistoryIcon /> <span>Histórico</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={projectActions.onDeleteProject}
                      disabled={projectActions.deleting}
                      tooltip="Deletar projeto"
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 /> <span>Deletar projeto</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
