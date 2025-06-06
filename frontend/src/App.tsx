import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { useEffect } from "react";
import { Outlet, useNavigate } from 'react-router-dom'
import useClientStore from "@/store/appStore"
export default function App() {
  const navigate = useNavigate();
  const { connectWS, closeWS, setIsClient } = useClientStore()
  const isClientEnv = window.location.hostname.includes('wails.localhost');
  const enterClient = window.location.pathname.includes('/client') || window.location.pathname.includes('/');
  useEffect(() => {
    // 设置为客户端
    setIsClient(true)
    // 连接socket数据
    connectWS()
    // '/client'路由导航守卫
    console.log(enterClient, isClientEnv, navigate);
    // !isClientEnv && enterClient && navigate("/web", { replace: true });
    return  () => {
      closeWS()
    }
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