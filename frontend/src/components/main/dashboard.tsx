import { ChartAreaInteractive } from "@/components/chart-area-interactive"
import { DataTable } from "@/components/data-table"
import { SectionCards, type DeviceInfo } from "@/components/section-cards"
import { useEffect, useState } from "react"
import data from "../../data.json"
export default function Dashboard() {
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo>({
    cpuInfo: {
      modelName: '-',
      cores: 0,
    },
    memInfo: {
      total: 0
    }
  })
  const [deviceLogs, setDeviceLogs] = useState<any>([])
  let wsHandle: (null | WebSocket) = null
  useEffect(() => {
    fetchData()
    connectWS()
    return () => wsHandle?.close()
  }, [])
  const fetchData = async () => {
    const response = await fetch("http://127.0.0.1:4321/api/v1/getDeviceInfo")
    const res = await response.json()
    if (res.code === 200) {
      setDeviceInfo(res.data)
    } 
  }
  const connectWS = () => {
    wsHandle = new WebSocket("ws://127.0.0.1:4321/ws")
    wsHandle.onmessage = (event) => {
      const info = JSON.parse(event.data);
      setDeviceLogs((prev: any) => {
        const newLogs = prev.length >= 24 ? [...prev.slice(-23), info] : [...prev, info];
        return newLogs;
      });
    };
  }
  return (<div className="@container/main flex flex-1 flex-col gap-2">
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <SectionCards deviceInfo={deviceInfo} deviceLogs={deviceLogs}/>
      <div className="px-4 lg:px-6">
        <ChartAreaInteractive deviceLogs={deviceLogs}/>
      </div>
      <DataTable data={data} />
    </div>
  </div>)
}

