import React from "react"
import { FolderOpen, RefreshCcwDot, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useApiRequest } from "@/tools/request"
import { toast } from "sonner"
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from "@/components/ui/popover"
import { Label } from "@/components/ui/label"
import { OpenDirectory, UpdateConfigData, RestartServer, ExitApp } from "@clientSDK/App"
export default function Settings() {
  const { request } = useApiRequest()
  const [sharedDir, setSharedDir] = React.useState<string>("")
  const [tokenExpiryTime, setTokenExpiryTime] = React.useState<number>(24)
  const [needUpdateConfig, setNeedUpdateConfig] = React.useState<any>({})
  const [changeDirFlag, setChangeDirFlag] = React.useState<boolean>(false)
  const [popoverOpen, setPopoverOpen] = React.useState(false)
  const openDirectory = () => {
    OpenDirectory().then(res => {
      if (res.dir) {
        setSharedDir(res.dir)
        setNeedUpdateConfig({...needUpdateConfig, sharedDir: res.dir})
        setChangeDirFlag(true)
      }
    }).catch(err => {
      console.log(err)
    })
  }
  const restartServer = () => {
    console.log( "needUpdateConfig", needUpdateConfig)
    UpdateConfigData(needUpdateConfig).then(res => {
      console.log("UpdateDefaultDir", res)
      if (res.status === "success") {
        RestartServer()
        toast.success('服务重启成功！')
        setChangeDirFlag(false)
      }
    })
  }

  const getConfigData = () => {
    request("/getConfigData").then(res => {
      if (res?.code === 200) {
        setSharedDir(res.data.sharedDir)
        setTokenExpiryTime(res.data.tokenExpiryTime)
      }
    })
  }

  React.useEffect(() => {
    getConfigData()
  }, [])
  return (
    <div className="flex flex-col items-start justify-center gap-4 p-6">
      <div className="flex items-center space-x-2 w-full mb-4">
        <Label htmlFor="setSharedDir" className="w-32">设置分享目录</Label>
        <div className="relative grid flex-1 gap-2 w-96">
          <Input
            readOnly
            value={sharedDir}
            className="text-sm font-medium"
          />
          <Button variant="outline" className="px-3 absolute right-0" onClick={openDirectory}>
            <FolderOpen size={20} />
          </Button>
          {
            changeDirFlag && <p className="absolute bottom-0 left-0 text-xs text-muted-foreground text-red-300" style={{ bottom: "-20px" }}>修改后需点击按钮重启服务。</p>
          }
        </div>
        <Button className="px-3" onClick={restartServer}>
          <RefreshCcwDot size={20} />
          保存重启服务
        </Button>
      </div>
      <div className="flex items-center space-x-2 relative w-full mb-4">
        <Label htmlFor="tokenExpTime" className="w-32">用户身份过期时间（小时）</Label>
        <Input
          value={tokenExpiryTime ?? 24}
          type="number"
          className="text-sm font-medium w-52"
          onChange={(e) => {
            let time = parseInt(e.target.value) || 24
            setTokenExpiryTime(time)
            setNeedUpdateConfig({...needUpdateConfig, tokenExpiryTime: time})
          }}
        />
        <p className="absolute bottom-0 left-0 text-xs text-muted-foreground text-red-300" style={{ bottom: "-20px" }}>设置用户身份过期后，原先授权的用户不会受影响。（设置后请重启服务）</p>
      </div>
      <div className="flex items-center space-x-2 w-full mb-4">
        <Label htmlFor="exitApp" className="w-32">退出LanDrop</Label>
        <Popover open={popoverOpen}>
          <PopoverTrigger asChild> 
            <Button variant="destructive" className="px-6" onClick={() => setPopoverOpen(true)}>
              <LogOut size={20} />
              退出
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80">
            <div className="grid gap-4">
              <div className="space-y-2">
                <h4 className="leading-none font-medium text-center">您确定要退出LanDrop吗？</h4>
                <p className="text-muted-foreground text-sm text-center">当退出后，web服务、dns服务等其他工具服务都会被停止，您确认要退出吗？</p>
              </div>
              <div className="flex justify-center gap-6">
                <Button className="px-6" onClick={() => setPopoverOpen(false)}>取消</Button>
                <Button variant="destructive" className="px-6" onClick={() => {setPopoverOpen(false);ExitApp();}}>退出</Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  )
}