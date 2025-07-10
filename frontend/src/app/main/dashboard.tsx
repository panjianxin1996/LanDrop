import { ChartNetwork } from "@/components/main/chart-network"
import { SectionCards, type DeviceInfo } from "@/components/main/chart-device-info"
import { useEffect, useState } from "react"
import { useApiRequest } from "@/tools/request"
import useClientStore from "@/store/appStore";
export default function Dashboard() {
  const { deviceLogsData, userInfo } = useClientStore()
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo>({
    cpuInfo: { modelName: '-', cores: 0, },
    memInfo: { total: 0 }
  })
  const { request } = useApiRequest()
  useEffect(() => {
    if (userInfo.token) fetchData()
  }, [userInfo.token])
  const fetchData = async () => {
    const res = await request("/getDeviceInfo")
    if (res?.code === 200) {
      setDeviceInfo(res.data)
    }
  }
  return (<div className="@container/main flex flex-1 flex-col gap-2">
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <SectionCards deviceInfo={deviceInfo} deviceLogs={deviceLogsData} />
      <div className="px-4 lg:px-6">
        <ChartNetwork deviceLogs={deviceLogsData} />
      </div>
    </div>
  </div>)
}

