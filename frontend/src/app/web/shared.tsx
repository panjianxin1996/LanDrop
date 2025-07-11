import DirList from "@/components/common/dir-list"
import { useApiRequest } from "@/tools/request"
import { useEffect, useState } from "react"
export default function Shared() {
    const { request } = useApiRequest()
    const [sharedData, setSharedData] = useState<any>([])
    const [sharedDir, setSharedDir] = useState<string>("")

    useEffect(() => {
        getSharedDirInfo()
    }, [])
    const getSharedDirInfo = () => {
        request("/getSharedDirInfo").then(res => {
            if (res?.code === 200) {
                setSharedData(res.data.files)
                setSharedDir(res.data.sharedDir)
            } else {
                console.log(res)
            }
        })
    }
    return <div className="w-full sm:pl-20">
        <DirList className="sm:w-[calc(100%-80px)] w-full" dirData={sharedData} sharedDir={sharedDir} reload={getSharedDirInfo} />
    </div>
}