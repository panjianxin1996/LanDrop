"use client"

import * as React from "react"
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent
} from "@/components/ui/chart"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import useStore,{useLogsStore} from "@/store/appStore"
import { useApiRequest } from "@/tools/request"

const chartConfig = {
  visitors: {
    label: "Visitors",
  },
  desktop: {
    label: "Desktop",
    color: "hsl(var(--chart-1))",
  },
  mobile: {
    label: "Mobile",
    color: "hsl(var(--chart-2))",
  },
} satisfies ChartConfig

export function ChartNetwork({  }: {
  // deviceLogs: Array<any>
}) {
  const { request } = useApiRequest()
  const { selectNetAdapter, setSelectNetAdapter, netAdapterList, ipv4Address, ipv6Address, userInfo,  } = useStore()
  const {deviceLogsData} = useLogsStore()
  const [allNetData, setAllNetData] = React.useState<any>([])

  React.useEffect(() => {
    if (selectNetAdapter) {
      if (userInfo.token) selectNetAdapterEvent(selectNetAdapter)
    }
  }, [userInfo.token])

  React.useEffect(() => {
    if (deviceLogsData.length > 0) {
      setAllNetData(deviceLogsData)
    }
  }, [deviceLogsData])

  const filteredData = allNetData.map((item: any) => {
    return {
      time: item.time,
      upload: selectNetAdapter && item[selectNetAdapter] && item[selectNetAdapter].upload,
      download: selectNetAdapter && item[selectNetAdapter] && item[selectNetAdapter].download
    }
  })

  const selectNetAdapterEvent = (adapterCode: string) => {
    setSelectNetAdapter(adapterCode, newData => {
      // 通知客户端本地ip地址作为dns服务器
      if (!newData.ipv4Address || !newData.ipv6Address) {
        return
      }
      request('/setIpAddress', 'POST', { ipv4: newData.ipv4Address, ipv6: newData.ipv6Address })
    })

  }

  return (
    <Card className="@container/card">
      <CardHeader className="relative">
        <CardTitle>网络使用情况</CardTitle>
        <CardDescription>
          <p className="@[540px]/card:hidden text-xs">你的分享服务根据您的网卡进行变更，包括dns服务。</p>
          <p className="text-xs">
            <span className='font-mono text-sm bg-gray-100 dark:bg-gray-800 rounded px-1 py-0.5'>{ipv4Address}</span>
            <span className='font-mono text-sm bg-gray-100 dark:bg-gray-800 rounded px-1 py-0.5 ml-2'>{ipv6Address}</span>
          </p>
        </CardDescription>
        <div className="absolute right-4 top-4">
          <Select value={selectNetAdapter} onValueChange={val => selectNetAdapterEvent(val)}>
            <SelectTrigger
              className="@[767px]/card:hidden flex w-40"
              aria-label="获取网卡列表中..."
            >
              <SelectValue placeholder="获取网卡列表中..." />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              {
                netAdapterList.map((item: any) => {
                  return (
                    <SelectItem value={item.name} key={item.name} className="rounded-lg">
                      {item.name}
                    </SelectItem>
                  )
                })
              }
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[250px] w-full"
        >
          <AreaChart data={filteredData}>
            <defs>
              <linearGradient id="fillDesktop" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="#111827"
                  stopOpacity={1.0}
                />
                <stop
                  offset="95%"
                  stopColor="#111827"
                  stopOpacity={0.1}
                />
              </linearGradient>
              <linearGradient id="fillMobile" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="#27272a"
                  stopOpacity={0.8}
                />
                <stop
                  offset="95%"
                  stopColor="#27272a"
                  stopOpacity={0.1}
                />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="time"
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => value.split(" ")[1]}
            />
            <ChartTooltip
              cursor={true}
              formatter={(value: number, type: string, item: any) => {
                return <>
                  <span className="w-2 h-2" style={{ backgroundColor: item.color }}></span>
                  <span>{type === 'upload' ? '上传' : '下载'}</span>
                  <span>{(value / 1024)?.toFixed(2)} KB</span>
                </>
              }}
              content={
                <ChartTooltipContent
                  labelFormatter={(value) => {
                    return new Date(value).toLocaleTimeString()
                  }}
                  indicator="dot"
                />
              }
            />
            <Area
              dataKey="upload"
              type="natural"
              fill="url(#fillMobile)"
              stroke="#d6d3d1"
              stackId="a"
            />
            <Area
              dataKey="download"
              type="natural"
              fill="url(#fillDesktop)"
              stroke="#d1d5db"
              stackId="a"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
