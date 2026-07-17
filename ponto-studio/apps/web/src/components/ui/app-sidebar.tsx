import { useLocation, useNavigate } from "react-router-dom";
import { FolderKanban } from "lucide-react";
import type { CanvasSize } from "@ponto-studio/shared";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar.tsx";

interface ProjectContext {
  name: string;
  canvas: CanvasSize;
}

interface Props extends React.ComponentProps<typeof Sidebar> {
  projectContext?: ProjectContext;
  /** Editor.tsx passa o onBackToHome recebido via props; Home não passa nada (já está em "/"). */
  onNavigateHome?: () => void;
}

/**
 * Sidebar de navegação compartilhada entre as duas dashboards (Home e
 * Editor) — peça central do design system: a navegação principal é
 * visualmente idêntica nas duas telas.
 */
export function AppSidebar({ projectContext, onNavigateHome, ...props }: Props) {
  const location = useLocation();
  const navigate = useNavigate();
  const goHome = onNavigateHome ?? (() => navigate("/"));

  return (
    <Sidebar collapsible="none" className="h-full w-full border-r-0" {...props}>
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <span className="text-2xl leading-none">🪡</span>
          <span className="text-sm font-bold">Ponto Studio</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navegação</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={goHome} isActive={location.pathname === "/"}>
                  <FolderKanban />
                  <span>Meus projetos</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {projectContext && (
          <SidebarGroup>
            <SidebarGroupLabel>Projeto</SidebarGroupLabel>
            <SidebarGroupContent className="px-2 text-sm">
              <p className="truncate font-medium text-sidebar-foreground">{projectContext.name}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {Math.round(projectContext.canvas.widthMm)} × {Math.round(projectContext.canvas.heightMm)} mm
              </p>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
