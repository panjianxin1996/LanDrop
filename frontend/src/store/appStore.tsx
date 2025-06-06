import { create } from 'zustand'
import { persist } from 'zustand/middleware' // 持久化存储到localStorage

type AppStore = {
  isClient: boolean // 是否客户端【区分为客户端app和用户端web】
  setIsClient: (isClient: boolean) => void // 设置为客户端
  deviceLogsData: any // 设备数据
  setDeviceData: (deviceLogsData: any) => void // 设置设备数据
  wsHandle: WebSocket | null // websocket实例
  connectWS: () => void // 连接websocket
  closeWS: () => void // 关闭websocket
  selectNetAdapter: string // 选择的网络适配器
  setSelectNetAdapter: (selectNetAdapter: string) => void // 设置选择网络适配器
}

// 持久化白名单
const blackList = ['deviceLogsData', 'wsHandle']

const useClientStore = create<AppStore>()(persist(
  (set, get) => ({
    isClient: false,
    setIsClient: isClient => set({ isClient }),
    deviceLogsData: [],
    setDeviceData: deviceLogsData => set({ deviceLogsData }),
    wsHandle: null,
    connectWS: () => {
      let wsHandle = new WebSocket("ws://127.0.0.1:4321/ws")
      set({ wsHandle })
      wsHandle.onmessage = (event) => {
        const info = JSON.parse(event.data);
        set(state => ({
          // 只存放24条数据
          deviceLogsData: state.deviceLogsData.length >= 24 ? [...state.deviceLogsData.slice(-23), info] : [...state.deviceLogsData, info]
        }))
      };
    },
    closeWS: () => {
      const wsHandle = get().wsHandle
      wsHandle?.close()
    },
    selectNetAdapter: "",
    setSelectNetAdapter: (selectNetAdapter) => {
      set({selectNetAdapter})
    }
  }), { name: 'client-store', partialize: (state) => Object.fromEntries( Object.entries(state).filter(([key]) => !blackList.includes(key))), })
)

export default useClientStore