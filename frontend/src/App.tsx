import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { useEffect } from "react";
import { Outlet, useNavigate } from 'react-router-dom'
export default function App() {
  const navigate = useNavigate();
  const isClientEnv = window.location.hostname.includes('wails.localhost');
  const enterClient = window.location.pathname.includes('/client') || window.location.pathname.includes('/');
  useEffect(() => {
    // '/client'路由导航守卫
    console.log(enterClient, isClientEnv, navigate);
    // !isClientEnv && enterClient && navigate("/web", { replace: true });
  }, [])
  return (
    // return !isClientEnv && enterClient ? <></> : (
    <SidebarProvider>
      {/* 侧边栏 */}
      <AppSidebar variant="inset" />
      {/* 主体 */}
      <SidebarInset className="!w-3/5">
        <SiteHeader />
        <main className=" flex flex-1 flex-col">
          {/* {window.location.href} */}
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}