import * as React from "react"
import {
  ArrowUpCircleIcon,
} from "lucide-react"
import { NavMain } from "@/components/main/nav-main"
import { NavSecondary } from "@/components/main/nav-secondary"
import { NavUser } from "@/components/main/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { navMain, navSecondary } from "@/router"
import { Link } from 'react-router-dom'
export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="offcanvas" {...props} className="pt-4">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <Link to="shared">
                <ArrowUpCircleIcon className="h-5 w-5" />
                <span className="text-base font-semibold">当前分享</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navMain} />
        <NavSecondary items={navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser/>
      </SidebarFooter>
    </Sidebar>
  )
}
