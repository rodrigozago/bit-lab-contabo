import { type LucideIcon } from "lucide-react"
import { Link, useLocation } from "react-router-dom"

import { SidebarGroup, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar"

export function NavMain({
  label,
  items,
}: {
  label: string
  items: { title: string; url: string; icon?: LucideIcon }[]
}) {
  const location = useLocation()

  return (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => (
          <SidebarMenuItem key={item.url}>
            <SidebarMenuButton
              asChild
              tooltip={item.title}
              className="cursor-pointer"
              isActive={location.pathname === item.url}
            >
              <Link to={item.url}>
                {item.icon && <item.icon />}
                <span>{item.title}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  )
}
