import { useApiRequest } from "@/tools/request"
import { useEffect, useState } from "react"
import { File,List,LayoutGrid,Columns } from "lucide-react"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

export default function Shared() {
  const { request } = useApiRequest()
  // 分享文件列表信息
  const [sharedData, setSharedData] = useState<any>([{name: '123'}])
  const [ showType, setShowType ] = useState<string>("card")
  useEffect(() => {
    getSharedDirInfo()
  }, [])
  const getSharedDirInfo = () => {
    request("/getSharedDirInfo").then(res => {
      if (res?.code === 200) {
        setSharedData(res.data.files)
      }
    })
  }
  const changeShowType = (type: string) => {
    setShowType(type)
  }
  return (
    <div className="flex flex-col gap-4 p-4 h-96">
      <div className="flex justify-between">
        <div></div>
        <ToggleGroup value={showType} type="single" onValueChange={(type) => changeShowType(type)}>
          <ToggleGroupItem value="columns"><Columns /></ToggleGroupItem>
          <ToggleGroupItem value="card"><LayoutGrid /></ToggleGroupItem>
          <ToggleGroupItem value="list"><List /></ToggleGroupItem>
        </ToggleGroup>
      </div>
      <div className="flex h-full">
      <div className={`flex ${showType === "list" ? "flex-col" : "flex-wrap items-start"} gap-4 ${showType === "columns" ? "w-3/5" : "w-full"}`}>
        {
          sharedData?.map((item: any) => (
            <div key={item.name} className={`flex ${showType === 'list' ? '' : 'flex-col justify-center'} items-center gap-2 cursor-pointer`}>
              <File size={showType === 'list' ? 20 : 50} strokeWidth={1}/>
              <p className="text-sm leading-none font-medium">{item.name}</p>
              {showType === "list" && <p className="text-sm leading-none font-medium">{item.mod_time}</p>}
            </div>
          ))
        }
      </div>
      {showType === "columns" && <div className="w-2/5 h-full border-l-2 border-gray-200 p-5">分栏</div>}
      </div>
    </div>
  )
}