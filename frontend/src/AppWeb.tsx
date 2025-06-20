import {
    TooltipProvider,
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
    InputOTP,
    InputOTPGroup,
    InputOTPSlot,
} from "@/components/ui/input-otp"
import { TextSearch, CloudUpload, MessageCircle } from 'lucide-react'
import useClientStore from "@/store/appStore"
import { useEffect, useState } from "react"
import DirList from "@/components/common/dir-list"
import { useApiRequest } from "@/tools/request"

export default function AppWeb() {
    const { checkIsClient } = useClientStore()
    const { request } = useApiRequest()
    // 分享文件列表信息
    const [sharedData, setSharedData] = useState<any>([])
    const [sharedDir, setSharedDir] = useState<string>("")
    const [openAlert, setOpenAlert] = useState<boolean>(false)
    const [sharedCode, setSharedCode] = useState<string>("")
    useEffect(() => {
        // web端设置为非客户端
        checkIsClient()
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

    const getRealFilePath = () => {
        request("/getRealFilePath?fileCode=" + sharedCode).then(res => {
            if (res?.code === 200) {
                console.log(res.data)
                setSharedCode("")
            }
        })
    }

    const btnList = [
        { key: 'getSharedFile', name: "分享码", icon: <TextSearch size={25} />, tip: "通过分享码获取文件" },
        { key: 'goAndshare', name: "分享", icon: <CloudUpload size={25} />, tip: "我想发起文件分享，提供给其他人使用。【需要客户端授权】" },
        { key: 'message', name: "消息", icon: <MessageCircle size={25} />, tip: "跟好友进行聊天" },
    ]
    return <TooltipProvider>
        <AlertDialog open={openAlert} onOpenChange={setOpenAlert}>
            {/* <AlertDialogTrigger>Open</AlertDialogTrigger> */}
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle className="text-center">请输入分享码</AlertDialogTitle>
                    <AlertDialogDescription asChild >
                        <div className="flex justify-center py-8">
                            <InputOTP maxLength={6} value={sharedCode} onChange={(value) => { setSharedCode(value) }}>
                                <InputOTPGroup>
                                    <InputOTPSlot index={0} className="h-16 w-14" />
                                    <InputOTPSlot index={1} className="h-16 w-14" />
                                    <InputOTPSlot index={2} className="h-16 w-14" />
                                    <InputOTPSlot index={3} className="h-16 w-14" />
                                    <InputOTPSlot index={4} className="h-16 w-14" />
                                    <InputOTPSlot index={5} className="h-16 w-14" />
                                </InputOTPGroup>
                            </InputOTP>
                        </div>
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="flex justify-center">
                    <AlertDialogCancel>取消</AlertDialogCancel>
                    <AlertDialogAction onClick={() => getRealFilePath()}>确认</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
        <div className="flex border-b-2" style={{height: "95vh"}}>
            <div className="w-20 border-r-2 pt-10">
                {
                    btnList.map(item => (
                        <Tooltip key={item.key}>
                            <TooltipTrigger asChild>
                                <div className="flex flex-col justify-center items-center cursor-pointer hover:bg-gray-100 py-4" onClick={() => (item.key === "getSharedFile" && setOpenAlert(true))}>
                                    {item.icon}
                                    <span className="text-xs">{item.name}</span>
                                </div>
                            </TooltipTrigger>
                            <TooltipContent side="right">
                                <p>{item.tip}</p>
                            </TooltipContent>
                        </Tooltip>
                    ))
                }
            </div>
            <DirList className="w-[calc(100%-80px)]" dirData={sharedData} sharedDir={sharedDir} reload={getSharedDirInfo} />
        </div>
    </TooltipProvider>
}