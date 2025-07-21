import { MemoryStickIcon, CpuIcon } from "lucide-react"
import { CartesianGrid, Line, LineChart, YAxis } from "recharts"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardDescription,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import useClientStore from "@/store/appStore";
const chartConfig = {
  desktop: {
    label: "Desktop",
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig

interface CpuInfo {
  modelName: string,
  cores: number,
}
interface MemInfo {
  total: number,
}
export interface DeviceInfo {
  cpuInfo: CpuInfo;
  memInfo: MemInfo;
}
export function SectionCards({ deviceInfo }: {
  deviceInfo: DeviceInfo, // 设备信息
  // deviceLogs: Array<any> // 设备日志
}) {
  const devicesCard: Array<any> = [
    { type: 'cpu', title: 'CPU利用率', icon: <CpuIcon size={15} />, iconDesc: '核', lineType: 'cpuUsage' },
    { type: 'mem', title: '内存利用率', icon: <MemoryStickIcon size={15} />, iconDesc: '-', lineType: 'memUsage' },
  ]
  const { deviceLogsData } = useClientStore()
  return (
    <div className="*:data-[slot=card]:shadow-xs md:grid-cols-[repeat(2,minmax(0,1fr))] grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card lg:px-6">
      {
        devicesCard.map((item: any) => {
          return <Card className="@container/card flex flex-col justify-between" key={"section_card_" + item.type}>
            <CardHeader className="relative">
              <CardDescription>{item.title}</CardDescription>
              <CardTitle className="@[250px]/card:text-3xl text-sm font-semibold tabular-nums">
                {item.type === 'cpu' ? deviceInfo?.cpuInfo?.modelName : `内存容量：${deviceInfo?.memInfo?.total ? ((deviceInfo?.memInfo?.total) / 1024 / 1024 / 1024).toFixed(0) : 0}G`}
              </CardTitle>
              <div className="absolute right-4 top-4">
                <Badge variant="outline" className="flex gap-1 rounded-lg text-xs">
                  {item.icon}
                  {item.type === 'cpu' ? `${deviceInfo?.cpuInfo?.cores || '-'}核` : '-'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {/* cpu负载量图表 */}
              <ChartContainer config={chartConfig}>
                <LineChart
                  accessibilityLayer
                  data={deviceLogsData}
                  margin={{
                    left: 0,
                    right: 0,
                    top: 10,
                    bottom: 10
                  }}>
                  <CartesianGrid vertical={false} />
                  <YAxis
                    domain={[0, 100]}           // 固定纵坐标范围 0-100
                    axisLine={false}            // 隐藏轴线
                    tickLine={false}            // 隐藏刻度线
                  />
                  <ChartTooltip
                    cursor={false}
                    content={<ChartTooltipContent hideLabel />}
                  />
                  <Line
                    dataKey={item.lineType}
                    type="linear" //  使用线性类型 linear：折现，natural：曲线
                    stroke="gray"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ChartContainer>
              <div className="flex flex-row justify-between text-xs">
                <div className="text-gray-500">2分钟</div>
                <div className="text-gray-500">现在</div>
              </div>
            </CardContent>
          </Card>
        })
      }
    </div>
  )
}
