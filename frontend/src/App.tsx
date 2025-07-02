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
  const { isClient, checkIsClient, setStoreData, connectWS, closeWS, selectNetAdapter, setSelectNetAdapter, adminName } = useClientStore()

  useEffect(() => {
    checkIsClient().then(res => {
      if (res) {
        // 客户端鉴权登录
        appLogin()
      } else {
        if (checkPagePath()) navigate("/web", { replace: true });
      }
    })
    return () => {
      closeWS()
    }
  }, [])

  // 检测是否为客户端首页路由
  const checkPagePath = () => {
    return (window.location.pathname.includes('/client') || window.location.pathname.includes('/'))
  }

  const getNetworkInfo = () => {
    request("/getNetworkInfo").then(res => {
      if (res && res.code === 200) {
        setStoreData({ name: 'netAdapterList', value: res.data })
        if (selectNetAdapter === "") {
          // 如果第一次加载选中第一个网卡
          setSelectNetAdapter(res.data[0].name)
        }
      }
    })
  }

  const appLogin = () => {
    let newAdminName
    if (!adminName) {
      newAdminName = `admin${(Math.random() * 1000).toFixed(0)}`
    }
    setStoreData({
      name: 'adminName', value: newAdminName, endSet: (store) => {
        request("/appLogin", "POST", {
          adminName: store.adminName,
          adminPassword: `landrop#${store.adminName}`,
          timeStamp: new Date().getTime().toString()
        }).then(res => {
          if (res && res.code === 200) {
            localStorage.setItem("ldtoken", res.data.token)
            setStoreData({
              beforeSet: (_, set) => {
                set({ token: res.data.token, adminName: res.data.adminName, adminId: res.data.adminId })
              },
              endSet: (store) => {
                // 连接socket数据
                connectWS(store.adminId, store.adminName, store.token)
              }
            })
            // 获取网卡列表
            getNetworkInfo()
          }
        })
      }
    })

  }

  return !isClient && checkPagePath() ? <></> : (<SidebarProvider style={{ height: "100vh" }}>
    {/* return (<SidebarProvider> */}
    {/* 侧边栏 */}
    <AppSidebar variant="inset" />
    {/* 主体 */}
    <SidebarInset className="!w-3/5">
      <SiteHeader />
      <main className=" flex flex-1 flex-col">
        <Outlet />
      </main>
    </SidebarInset>
  </SidebarProvider>)
}