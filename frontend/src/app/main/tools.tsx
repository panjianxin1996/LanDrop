import { ToolsParseToken, ToolsPingHost } from "@clientSDK/App"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useState, useRef } from "react"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Braces, Cable, Loader } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import useClientStore from "@/store/appStore"
export default function Tools() {
  const { userInfo } = useClientStore()
  const [backData, setBackData] = useState<Array<string>>([])
  const [loading, setLoading] = useState<boolean>(false)
  const sendRef = useRef<any>("")
  const containerRef = useRef<any>(null)
  // 解析token
  const parseToken = () => {
    setBackData([])
    setLoading(true)
    if (!sendRef.current) {
      return
    }
    ToolsParseToken(sendRef.current).then((res: any) => {
      setBackData([JSON.stringify(res, null, 2)])
    }).catch(err => {
      setBackData([err])
    }).finally(() => {
      setLoading(false)
    })
  }
  // ping主机
  const PingHost = (host: string) => {
    setBackData([])
    setLoading(true)
    ToolsPingHost(1, host).then((res: any) => {
      setBackData([
        `主机地址：${res.host}，解析ip地址：${res.ip.IP}`,
        ...res.recv,
        ...res.result
      ])
      // setBackData(res)
    }).catch(err => {
      setBackData([err])
    }).finally(() => {
      setLoading(false)
    })
  }
  return (
    <div className="flex justify-start flex-wrap gap-2 p-4">
      {/* 超级管理员才能查看  */
        userInfo.role === "admin+" && <Sheet>
          <SheetTrigger asChild>
            <Card className="w-24 h-24 cursor-pointer hover:bg-gray-50 relative overflow-hidden" onClick={() => setBackData([])}>
              <p className="absolute w-16 top-2 -right-4 text-white bg-red-500 text-xs rotate-45 text-center">超管</p>
              <CardContent className="flex flex-col justify-center items-center h-full p-0">
                <Braces />
                <span className="text-sm text-slate-600 mt-4">解析Token</span>
              </CardContent>
            </Card>
          </SheetTrigger>
          <SheetContent className="!max-w-md">
            <SheetHeader>
              <SheetTitle>解析LDToken</SheetTitle>
              <SheetDescription asChild>
                <div>
                  <Textarea onChange={(e) => sendRef.current = e.target.value}></Textarea>
                  <p className="text-right my-4">
                    <Button onClick={() => { setBackData([]); sendRef.current = ""; }} size="sm" variant={"destructive"} className="mr-2" disabled={loading}>清空</Button>
                    <Button onClick={() => parseToken()} size="sm" disabled={!sendRef.current || loading}>
                      {
                        loading && <Loader size={15} className="animate-spin" />
                      }
                      <span>解析</span>
                    </Button>
                  </p>
                  <pre className="p-2 rounded bg-slate-700 text-white h-60 overflow-auto">
                    {backData[0]}
                  </pre>
                </div>
              </SheetDescription>
            </SheetHeader>
          </SheetContent>
        </Sheet>
      }
      <Sheet>
        <SheetTrigger asChild>
          <Card className="w-24 h-24 cursor-pointer hover:bg-gray-50" onClick={() => setBackData([])}>
            <CardContent className="flex flex-col justify-center items-center h-full p-0">
              <Cable />
              <span className="text-sm text-slate-600 mt-4">Ping主机</span>
            </CardContent>
          </Card>
        </SheetTrigger>
        <SheetContent className="!max-w-md">
          <SheetHeader>
            <SheetTitle>Ping主机连接</SheetTitle>
            <SheetDescription asChild>
              <div ref={containerRef}>
                <Input placeholder="请输入主机IP/域名地址" onChange={(e) => sendRef.current = e.target.value} />
                <p className="text-right my-4">
                  <Button onClick={() => PingHost(sendRef.current)} size="sm" disabled={!sendRef.current || loading}>
                    {
                      loading && <Loader size={15} className="animate-spin" />
                    }
                    <span>ping</span>
                  </Button>
                </p>
                <div className="p-2 rounded bg-slate-700 text-white h-60 overflow-auto">
                  {
                    backData?.map((item, i)=> (<p key={`${i}-backData`}>{item}</p>))
                  }
                </div>
              </div>
            </SheetDescription>
          </SheetHeader>
        </SheetContent>
      </Sheet>
    </div>
  )
}