import * as React from "react"
import {
  ArrowUpCircleIcon,
} from "lucide-react"
import { NavMain } from "@/components/main/nav-main"
import { NavSecondary } from "@/components/main/nav-secondary"
import { NavUser, type NavUserRef } from "@/components/main/nav-user"
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
import { useLocation } from 'react-router-dom'
type AppSidebarProps = {
  sidebarProps: React.ComponentProps<typeof Sidebar>;
  loginEvent?: (adminId: string, adminPwd: string) => void;
};

const AppSidebar = React.forwardRef<NavUserRef, AppSidebarProps>(({ sidebarProps, loginEvent }, ref) => {
  const { pathname } = useLocation()
  const [path, setPath] = React.useState("")
  React.useEffect(() => {
    setPath(pathname.split('/').slice(-1)[0])
  }, [pathname])
  return (
    <Sidebar collapsible="offcanvas" {...sidebarProps} className="pt-4">
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
        <NavMain items={navMain} path={path}/>
        <NavSecondary items={navSecondary} path={path} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser loginEvent={loginEvent} ref={ref}/>
      </SidebarFooter>
    </Sidebar>
  )
})
export {
  AppSidebar
} 