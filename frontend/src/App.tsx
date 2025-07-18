import { AppSidebar } from "@/components/main/app-sidebar"
import { SiteHeader } from "@/components/main/app-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { useCallback, useEffect, useRef, useState } from "react";
import { Outlet, useNavigate } from 'react-router-dom'
import useClientStore from "@/store/appStore"
import { useApiRequest } from "@/tools/request"
import { Drawer, DrawerClose, DrawerTitle, DrawerContent, DrawerTrigger, DrawerHeader } from "@/components/ui/drawer"
import { Button } from "@/components/ui/button";
import { useConsole, ConsoleViewer } from '@/hooks/useConsole';
import { MonitorCog, CircleX } from 'lucide-react';
export default function App() {
  const navigate = useNavigate();
  const { request } = useApiRequest()
  const {
    logs,
    requests,
    isListening,
    startListening,
    stopListening,
    clearLogs,
    clearRequests,
  } = useConsole();
  const { isClient, checkIsClient, setStoreData, closeWS, selectNetAdapter, setSelectNetAdapter, userInfo, devMode } = useClientStore()
  const [userId, setUserId] = useState<number>(-1)
  const socketList = useRef<Array<any>>([])
  const timeoutHandle = useRef<any>(null)
  // const [socketData, setSocketData] = useState<any>({})
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
      if (isListening) stopListening()
    }
  }, [])

  useEffect(() => {
    if (devMode) {
      startListening()
    } else {
      if (isListening) stopListening()
    }
  }, [devMode])

  // 检测是否为客户端首页路由
  const checkPagePath = () => {
    return (window.location.pathname.includes('/client') || window.location.pathname.includes('/'))
  }

  const getNetworkInfo = () => { // 获取网卡信息
    request("/getNetworkInfo").then(res => {
      if (res && res.code === 200) {
        setStoreData({
          set: {
            netAdapterList: res.data,
          }
        })
        if (selectNetAdapter === "") {
          // 如果第一次加载选中第一个网卡
          setSelectNetAdapter(res.data[0].name)
        }
      }
    })
  }

  // 异步传递socket信息，将socket的信息暂存socketList，在100s内进行更新
  const setSocketQueue = useCallback(() => {
    if (!!timeoutHandle.current) return
    timeoutHandle.current = setTimeout(() => {
      const currentList = [...socketList.current]
      socketList.current = []
      setStoreData({
        before: (store, set) => {
          set({ socketQueue: [...store.socketQueue, ...currentList] })
        }
      })
      timeoutHandle.current = null
    }, (Math.random() * 100)) // 设置更新为100秒的延迟
  }, [])

  const connectWS = (id: string, name: string, token: string) => {
    let wsHandle = new WebSocket(`ws://127.0.0.1:${localStorage.getItem("appPort") || "4321"}/ws?ldToken=${token}&id=${id}&name=${name}`)
    wsHandle.onmessage = (event) => {
      const info = JSON.parse(event.data);
      if (info.type === "deviceRealTimeInfo") {
        let newNetWorkLog = { ...info.content.network, ...info.content }
        setStoreData({
          before: (_, set) => {
            set(state => ({// 只存放24条数据
              deviceLogsData: state.deviceLogsData.length >= 24 ? [...state.deviceLogsData.slice(-23), newNetWorkLog] : [...state.deviceLogsData, newNetWorkLog]
            }))
          }
        })
      } else {
        socketList.current.push(info)
        setSocketQueue()
      }
    }
    wsHandle.onopen = () => {
      setStoreData({
        set: {
          wsHandle: wsHandle,
        }
      })
      setUserId(+userInfo.userId)
    }

  }

  const appLogin = () => {
    let uName
    if (!userInfo.userName) uName = `admin${(Math.random() * 1000).toFixed(0)}`
    else uName = userInfo.userName
    setStoreData({
      set: { userInfo: { ...userInfo, userName: uName } },
      // name: 'userInfo', value: { ...userInfo, userName: uName }, 
      finish: (store) => {
        // console.log(store, "store")
        request("/appLogin", "POST", {
          adminName: store.userInfo.userName,
          adminPassword: `landrop#${store.userInfo.userName}`,
          timeStamp: new Date().getTime().toString()
        }).then(res => {
          if (res && res.code === 200) {
            // localStorage.setItem("ldtoken", res.data.token)
            setStoreData({
              before: (_, set) => {
                set({
                  userInfo: {
                    token: res.data.token,
                    userName: res.data.adminName,
                    nickName: res.data.nickName,
                    userId: res.data.adminId,
                    role: res.data.role,
                    avatar: res.data.avatar,
                  }
                })
              },
              finish: (store) => {
                // 连接socket数据
                connectWS(store.userInfo.userId, store.userInfo.userName, store.userInfo.token)
                // 获取网卡列表
                getNetworkInfo()
              }
            })
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
    <SidebarInset className="overflow-auto !w-3/5 !m-0 !rounded-none h-full ">
      <SiteHeader />
      <main className=" flex flex-1 flex-col">
        <Outlet context={{ userId: userId }} />
      </main>
    </SidebarInset>
    <Drawer>
      <DrawerTrigger asChild>
        {
          devMode && <Button variant={"outline"} className="absolute right-2 bottom-2"><MonitorCog size={15} /> 控制台</Button>
        }
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader className="pt-0 pb-0 flex justify-between items-center">
          <DrawerTitle>控制台</DrawerTitle>
          <DrawerClose asChild>
            <Button variant="ghost" size={"sm"}><CircleX size={20}/></Button>
          </DrawerClose>
        </DrawerHeader>
        <div className="px-2">
          <ConsoleViewer
            logs={logs}
            requests={requests}
            onClearLogs={clearLogs}
            onClearRequests={clearRequests}
          />
        </div>
      </DrawerContent>
    </Drawer>
  </SidebarProvider>)
}