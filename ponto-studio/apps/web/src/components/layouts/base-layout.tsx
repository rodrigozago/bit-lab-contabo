import * as React from "react"
import type { CanvasSize } from "@ponto-studio/shared"

import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

interface BaseLayoutProps {
  children: React.ReactNode
  title?: string
  description?: string
  /** Ações da tela no topbar (antes do ModeToggle). */
  headerActions?: React.ReactNode
  /** Contexto de projeto repassado pra sidebar (só no Editor). */
  projectContext?: { name: string; canvas: CanvasSize }
}

/** Shell das dashboards no padrão do template (sem customizer/footer promo). */
export function BaseLayout({ children, title, description, headerActions, projectContext }: BaseLayoutProps) {
  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "16rem",
          "--sidebar-width-icon": "3rem",
          "--header-height": "calc(var(--spacing) * 14)",
        } as React.CSSProperties
      }
    >
      <AppSidebar projectContext={projectContext} />
      <SidebarInset>
        <SiteHeader actions={headerActions} />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
              {title && (
                <div className="px-4 lg:px-6">
                  <div className="flex flex-col gap-2">
                    <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
                    {description && <p className="text-muted-foreground">{description}</p>}
                  </div>
                </div>
              )}
              {children}
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
