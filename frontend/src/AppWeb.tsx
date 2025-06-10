import {
    TooltipProvider
} from "@/components/ui/tooltip"
import useClientStore from "@/store/appStore"
import { useEffect, useState } from "react"
import DirList from "@/components/common/dir-list"
import { useApiRequest } from "@/tools/request"

export default function AppWeb() {
    const { setIsClient } = useClientStore()
    const { request } = useApiRequest()
    // 分享文件列表信息
    const [sharedData, setSharedData] = useState<any>([])
    const [sharedDir, setSharedDir] = useState<string>("")
    useEffect(() => {
        // web端设置为非客户端
        setIsClient(false)
        // 获取分享目录
        getSharedDirInfo()
    }, [])
    const getSharedDirInfo = () => {
        request("/getSharedDirInfo").then(res => {
            if (res?.code === 200) {
                setSharedData(res.data.files)
                setSharedDir(res.data.sharedDir)
            }
        })
    }
    return <TooltipProvider>
        <div>
            <DirList dirData={sharedData} sharedDir={sharedDir} reload={getSharedDirInfo} />
        </div>
    </TooltipProvider> 
}