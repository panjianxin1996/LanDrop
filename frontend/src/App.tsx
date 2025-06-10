import { AppSidebar } from "@/components/main/app-sidebar"
import { SiteHeader } from "@/components/main/app-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { useEffect } from "react";
import { Outlet, useNavigate } from 'react-router-dom'
import useClientStore from "@/store/appStore"
import { useApiRequest } from "@/tools/request"
export default function App() {
  const navigate = useNavigate();
  const { request } = useApiRequest()
  const { connectWS, closeWS, setIsClient, setNetAdapterList } = useClientStore()
  const isClientEnv = window.location.hostname.includes('wails.localhost');
  const enterClient = window.location.pathname.includes('/client') || window.location.pathname.includes('/');
  useEffect(() => {
    // 设置为客户端
    setIsClient(true)
    // 连接socket数据
    connectWS()
    // 获取网卡列表
    getNetworkInfo()
    // '/client'路由导航守卫
    console.log(enterClient, isClientEnv, navigate);
    !isClientEnv && enterClient && navigate("/web", { replace: true });
    return () => {
      closeWS()
    }
  }, [])

  const getNetworkInfo = () => {
    request("/getNetworkInfo").then(res => {
      if (res.code === 200) {
        setNetAdapterList(res.data)
      }
    })
  }
  return !isClientEnv && enterClient ? <></> : (<SidebarProvider>
    {/* return <SidebarProvider> */}
    {/* 侧边栏 */}
    <AppSidebar variant="inset" />
    {/* 主体 */}
    <SidebarInset className="!w-3/5">
      <SiteHeader />
      <main className=" flex flex-1 flex-col">
        <Outlet />
      </main>
    </SidebarInset>
  </SidebarProvider>
  )
}