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

export function ChartAreaInteractive({ deviceLogs }: {
  deviceLogs: Array<any>
}) {
  const [allNetData, setAllNetData] = React.useState<any>([])
  const [netAdapters, setNetAdapters] = React.useState<any>([])
  const [selectNetAdapter, setSelectNetAdapter] = React.useState("")

  React.useEffect(() => {
    if (deviceLogs.length > 0) {
      setNetAdapters(deviceLogs[0].adapterList) // 可能出现用户自行更改网卡比如关闭、启用、新增
      if (selectNetAdapter === "") {
        setSelectNetAdapter(deviceLogs[0].adapterList[0].adapterCode)
      }
      setAllNetData(deviceLogs)
    }
  }, [deviceLogs])

  const filteredData = allNetData.map((item: any) => {
    return {
      time: item.time,
      upload: item[selectNetAdapter].upload,
      download: item[selectNetAdapter].download
    }
  })


  return (
    <Card className="@container/card">
      <CardHeader className="relative">
        <CardTitle>网络使用情况</CardTitle>
        <CardDescription>
          <span className="@[540px]/card:hidden">{netAdapters.find((item: any) => item.adapterCode === selectNetAdapter)?.adapterName}</span>
        </CardDescription>
        <div className="absolute right-4 top-4">
          <Select value={selectNetAdapter} onValueChange={setSelectNetAdapter}>
            <SelectTrigger
              className="@[767px]/card:hidden flex w-40"
              aria-label="选择你的网卡"
            >
              <SelectValue placeholder="选择你的网卡" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              {
                netAdapters.map((item: any) => {
                  return (
                    <SelectItem value={item.adapterCode} key={item.adapterCode} className="rounded-lg">
                      {item.adapterName}
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
                  <span className="w-2 h-2" style={{backgroundColor: item.color}}></span>
                  <span>{type === 'upload' ? '上传':'下载'}</span>
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
