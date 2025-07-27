import { AppSidebar } from "@/components/main/app-sidebar"
import { AppHeader } from "@/components/main/app-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { useCallback, useEffect, useRef, useState } from "react"
import { Outlet, useNavigate } from 'react-router-dom'
import useStore, { useLogsStore } from "@/store/appStore"
import { useApiRequest } from "@/tools/request"
import { Drawer, DrawerClose, DrawerTitle, DrawerContent, DrawerTrigger, DrawerHeader } from "@/components/ui/drawer"
import { Button } from "@/components/ui/button"
import { useConsole, ConsoleViewer } from '@/hooks/useConsole'
import { MonitorCog, CircleX } from 'lucide-react'
import { toast } from "sonner"
import { useWebSocket } from "@/hooks/useWebSocket"
// import { useLogsStore } from "@/store/deviceLogsStore"

export default function App() {
  console.log("App组件渲染", new Date())
  const navigate = useNavigate()
  const { request } = useApiRequest()
  const { sendMessage } = useWebSocket()
  const consoleHook = useConsole()

  // 只订阅需要响应式更新的状态
  const isClient = useStore(state => state.isClient)
  const userInfo = useStore(state => state.userInfo)
  const devMode = useStore(state => state.devMode)
  const selectNetAdapter = useStore(state => state.selectNetAdapter)
  const wsHandle = useStore(state => state.wsHandle)

  // 获取函数引用，避免重新渲染
  const checkIsClient = useStore.getState().checkIsClient
  const setStoreData = useStore.getState().setStoreData
  const closeWS = useStore.getState().closeWS
  const setSelectNetAdapter = useStore.getState().setSelectNetAdapter
  const addDeviceLog = useLogsStore.getState().addDeviceLog

  const socketList = useRef<Array<any>>([])
  const timeoutHandle = useRef<any>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const sidebarRef = useRef<any>(null)
  const adminLoginInfo = useRef<Record<string, any>>({
    adminName: '1000',
    adminPassword: 'admin@123',
  })

  const [trigger, setTrigger] = useState(false) // 自定义比较函数，避免不必要的更新

  // 检测是否为客户端首页路由
  const checkPagePath = useCallback(() => {
    return window.location.pathname.includes('/client') || window.location.pathname === '/'
  }, [])

  // 初始化用户信息
  useEffect(() => {
    if (userInfo.userId && userInfo.userPwd) {
      const pwd = atob(atob(userInfo.userPwd))
      adminLoginInfo.current = {
        adminName: userInfo.userId.toString(),
        adminPassword: pwd,
      }
    }
  }, [userInfo.userId, userInfo.userPwd])

  // 应用启动逻辑
  useEffect(() => {
    checkIsClient().then(res => {
      if (res) {
        // 客户端鉴权登录
        appLogin(adminLoginInfo.current, 'login')
      } else {
        if (checkPagePath()) navigate("/web", { replace: true })
      }
    })

    return () => {
      closeWS()
    }
  }, []) // 依赖数组保持为空

  // 开发模式控制台监听
  useEffect(() => {
    if (devMode) {
      consoleHook.startListening()
    } else {
      if (consoleHook.getState().isListening) consoleHook.stopListening()
    }

    return () => {
      if (consoleHook.getState().isListening) consoleHook.stopListening()
    }
  }, [devMode, consoleHook])

  // 获取网络信息
  const getNetworkInfo = useCallback(() => {
    request("/getNetworkInfo").then(res => {
      if (res?.code === 200) {
        setStoreData({
          netAdapterList: res.data,
        })
        if (selectNetAdapter === "" && res.data.length > 0) {
          setSelectNetAdapter(res.data[0].name)
        }
      }
    })
  }, [request, selectNetAdapter, setSelectNetAdapter, setStoreData])

  // 处理socket消息队列
  const setSocketQueue = useCallback(() => {
    if (timeoutHandle.current) return
    timeoutHandle.current = setTimeout(() => {
      const currentList = [...socketList.current]
      socketList.current = []
      setStoreData((state) => ({
        socketQueue: [...state.socketQueue, ...currentList]
      }))
      timeoutHandle.current = null
    }, Math.random() * 100)
  }, [setStoreData])

  // WebSocket消息处理
  const onMessage = useCallback((event: MessageEvent) => {
    try {
      const info = JSON.parse(event.data)

      switch (info.type) {
        case "deviceRealTimeInfo":
          const newNetWorkLog = { ...info.content.network, ...info.content }
          addDeviceLog(newNetWorkLog)
          break

        case "replyNotifyRedDotData":
          useStore.setState({
            redDotCount: info.content.data.totalCount,
            redDotList: info.content.data.redDotList
          })
          break

        default:
          if (["replyChatReceiveData", "replyAddFriends", "replyDealWithFriends", "replyLatestFriendList"].includes(info.type)) {
            setTrigger(prev => !prev)
          }
          socketList.current.push(info)
          setSocketQueue()
      }
    } catch (error) {
      console.error("解析WebSocket消息失败:", error)
    }
  }, [setSocketQueue, setTrigger, addDeviceLog])

  // 连接WebSocket
  const connectWS = useCallback((id: string, name: string, token: string) => {
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }

    const port = localStorage.getItem("appPort") || "4321"
    const wsHandle = new WebSocket(`ws://127.0.0.1:${port}/ws?ldToken=${token}&id=${id}&name=${name}`)
    wsRef.current = wsHandle

    wsHandle.onmessage = onMessage
    wsHandle.onopen = () => {
      useStore.setState({ wsHandle })
    }
  }, [onMessage])

  // 发送红点数据请求
  useEffect(() => {
    if (wsHandle) {
      sendMessage({ type: "getNotifyRedDotData" })
    }
  }, [wsHandle, trigger, sendMessage])

  // 应用登录
  const appLogin = useCallback((loginInfo: Record<string, any>, loginType: string) => {
    request("/appLogin", "POST", {
      ...loginInfo,
      timeStamp: Date.now().toString()
    }).then(res => {
      if (res?.code === 200) {
        toast.success("登录成功")

        if (loginType === 'change') {
          sidebarRef.current?.closeLoginDialog()
        }

        const userData = res.data
        useStore.setState({
          userInfo: {
            token: userData.token,
            userName: userData.adminName,
            nickName: userData.nickName,
            userId: userData.adminId,
            role: userData.role,
            avatar: userData.avatar,
            userPwd: btoa(btoa(loginInfo.adminPassword))
          }
        })

        // 连接WebSocket和获取网络信息
        connectWS(userData.adminId, userData.adminName, userData.token)
        getNetworkInfo()
      }
    }).catch(error => {
      console.error("登录失败:", error)
      toast.error("登录失败")
    })
  }, [request, connectWS, getNetworkInfo])

  // 管理员登录
  const appAdminLogin = useCallback((adminId: string, adminPwd: string) => {
    const tmpAdminInfo = { adminName: adminId, adminPassword: adminPwd }
    adminLoginInfo.current = tmpAdminInfo
    appLogin(tmpAdminInfo, "change")
  }, [appLogin])

  // 渲染逻辑
  if (!isClient && checkPagePath()) {
    return null
  }

  return (
    <SidebarProvider style={{ height: "100vh" }}>
      <AppSidebar
        sidebarProps={{ variant: 'inset' }}
        loginEvent={appAdminLogin}
        ref={sidebarRef}
      />
      <SidebarInset className="overflow-auto !w-3/5 !m-0 !rounded-none h-full">
        <AppHeader />
        <main className="flex flex-1 flex-col">
          <Outlet />
        </main>
      </SidebarInset>

      {devMode && (
        <Drawer>
          <DrawerTrigger asChild>
            <Button
              variant="outline"
              className="absolute right-2 bottom-2 z-10"
            >
              <MonitorCog size={15} /> 控制台
            </Button>
          </DrawerTrigger>
          <DrawerContent>
            <DrawerHeader className="pt-0 pb-0 flex justify-between items-center">
              <DrawerTitle>控制台</DrawerTitle>
              <DrawerClose asChild>
                <Button variant="ghost" size="sm">
                  <CircleX size={20} />
                </Button>
              </DrawerClose>
            </DrawerHeader>
            <div className="px-2">
              <ConsoleViewer
                useConsole={consoleHook}
                onClearLogs={consoleHook.clearLogs}
                onClearRequests={consoleHook.clearRequests}
              />
            </div>
          </DrawerContent>
        </Drawer>
      )}
    </SidebarProvider>
  )
}