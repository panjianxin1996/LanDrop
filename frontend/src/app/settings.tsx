import React from "react"
import { FolderOpen, RefreshCcwDot } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useApiRequest } from "@/tools/request"
import { toast } from "sonner"
import { OpenDirectory, UpdateDefaultDir, RestartServer } from "@clientSDK/App"
export default function Settings() {
  const { request } = useApiRequest()
  const [sharedDir, setSharedDir] = React.useState<string>("")
  const [changeDirFlag, setChangeDirFlag] = React.useState<boolean>(false)
  const openDirectory = () => {
    OpenDirectory().then(res => {
      if (res.dir) {
        setSharedDir(res.dir)
        setChangeDirFlag(true)
      }
    }).catch(err => {
      console.log(err)
    })
  }
  const restartServer = () => {
    UpdateDefaultDir(sharedDir).then(res => {
      console.log("UpdateDefaultDir", res)
      if (res.status === "success") {
        RestartServer()
        toast.success('服务重启成功！')
        setChangeDirFlag(false)
      }
    })
  }

  const getSharedDirInfo = () => {
    request("/getSharedDirInfo").then(res => {
      if (res?.code === 200) setSharedDir(res.data.sharedDir)
    })
  }

  React.useEffect(() => {
    getSharedDirInfo()
  }, [])
  return (
    <div className="flex flex-col items-start justify-center p-6">
      <div className="flex items-center space-x-2">
        <span className="text-sm font-medium">分享目录</span>
        <div className="relative grid flex-1 gap-2 w-96">
          <Input
            readOnly
            value={sharedDir}
            className="text-sm font-medium"
          />
          {
            changeDirFlag && <p className="absolute bottom-0 right-0 text-xs text-muted-foreground text-red-300">修改后需点击按钮重启服务。</p>
          }
        </div>
        {
          !changeDirFlag && <Button variant="outline" className="px-3" onClick={openDirectory}>
            <FolderOpen size={20}/>
          </Button>
        }
        {
          changeDirFlag && <Button variant="destructive" className="px-3" onClick={restartServer}>
            <RefreshCcwDot size={20} />
          </Button>
        }
      </div>
    </div>
  )
}