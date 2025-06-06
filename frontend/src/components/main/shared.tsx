import { useApiRequest } from "@/tools/request"
import { useEffect, useState } from "react"
import DirList from "@/components/common/dir-list"
export default function Shared() {
  const { request } = useApiRequest()
  // 分享文件列表信息
  const [sharedData, setSharedData] = useState<any>([{name: '123'}])
  useEffect(() => {
    getSharedDirInfo()
  }, [])
  const getSharedDirInfo = () => {
    request("/getSharedDirInfo").then(res => {
      if (res?.code === 200) {
        // 将文件名编码处理，解决get请求特殊文件名无法访问的问题
        setSharedData(res.data.files)
      }
    })
  }

  return (
    // <div className="flex flex-col gap-4 p-4">
      <DirList dirData={sharedData} />

  )
}