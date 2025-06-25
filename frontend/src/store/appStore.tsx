import { create } from 'zustand'
import { persist } from 'zustand/middleware' // 持久化存储到localStorage

type SetStoreDataParams = {
  name?: string // 更新storeKey
  value?: any // 更新storeValue
  beforeSet?: (store: AppStore, set: { // 更新前钩子
    (partial: AppStore | Partial<AppStore> | ((state: AppStore) => AppStore | Partial<AppStore>), replace?: false): void;
    (state: AppStore | ((state: AppStore) => AppStore), replace: true): void;
  }) => void
  endSet?: (store: AppStore) => void // 更新后钩子
}

type AppStore = {
  isClient: boolean // 是否客户端【区分为客户端app和用户端web】
  checkIsClient: () => boolean
  clientVersion: string
  setStoreData: (params: SetStoreDataParams) => void // 通用更新store数据函数
  deviceLogsData: any // 设备数据
  wsHandle: WebSocket | null // websocket实例
  connectWS: (id:string, name:string, token:string) => void // 连接websocket
  closeWS: () => void // 关闭websocket
  selectNetAdapter: string // 选择的网络适配器
  setSelectNetAdapter: (selectNetAdapter: string, cb?: (store: AppStore) => void) => void // 设置选择网络适配器
  netAdapterList: Array<any> // 网卡列表
  ipv4Address: string // ipv4地址
  ipv6Address: string // ipv6地址
  adminId: string,
  adminName: string,
  token: string,

}

// 持久化白名单
const blackList = ['deviceLogsData', 'wsHandle']

const useClientStore = create<AppStore>()(
  persist(
    (set, get) => ({
      isClient: false,
      checkIsClient: () => {
        // set({ isClient: true})
        // return true
        if ((window as any)?.go?.main?.App?.Version) {
          const version = (window as any)?.go?.main?.App?.Version();
          set({ isClient: true, clientVersion: version })
          return true
        } else {
          set({ isClient: false })
          return false
        }
      },
      clientVersion: '',
      setStoreData: (params: SetStoreDataParams) => {
        if (params.beforeSet) params.beforeSet(get(), set) // 前置钩子
        else if (params.name && params.value) set({ [params.name]: params.value }) // 没有传递钩子直接更新数据
        params.endSet && params.endSet(get()) // 完成后钩子
      },
      deviceLogsData: [],
      wsHandle: null,
      connectWS: (id:string, name:string, token:string) => {
        let wsHandle = new WebSocket(`ws://127.0.0.1:${localStorage.getItem("appPort") || "4321"}/ws?ldToken=${token}&id=${id}&name=${name}`)
        set({ wsHandle })
        wsHandle.onmessage = (event) => {
          const info = JSON.parse(event.data);
          if (info.type === "deviceRealTimeInfo") {
            let newNetWorkLog = { ...info.content.network, ...info.content }
            set(state => ({// 只存放24条数据
              deviceLogsData: state.deviceLogsData.length >= 24 ? [...state.deviceLogsData.slice(-23), newNetWorkLog] : [...state.deviceLogsData, newNetWorkLog]
            }))
          }
        };
      },
      closeWS: () => {
        get().wsHandle?.close()
      },
      selectNetAdapter: "",
      setSelectNetAdapter: (selectNetAdapter, callBack) => {
        let ipv4Address = '', ipv6Address = ''
        if (selectNetAdapter && get().netAdapterList.length > 0) {
          let ips = get().netAdapterList.find(item => item.name === selectNetAdapter)?.ips
          ipv4Address = ips?.find((item: string) => ['8', '16', '24', '32'].includes(item.split('/')[1]))?.split('/')[0]
          ipv6Address = ips?.find((item: string) => ['64', '128'].includes(item.split('/')[1]))?.split('/')[0]
        }
        set({ selectNetAdapter, ipv4Address, ipv6Address })
        callBack && callBack(get())
      },
      netAdapterList: [],
      ipv4Address: "",
      ipv6Address: "",
      adminId: "",
      adminName: "",
      token: "",
    }),
    // 设置持久化存储名称白名单
    { name: 'client-store', partialize: (state) => Object.fromEntries(Object.entries(state).filter(([key]) => !blackList.includes(key))) }
  )
)

export default useClientStore