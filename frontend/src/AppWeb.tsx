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
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    Card,
    CardContent,
} from "@/components/ui/card"
import {
    InputOTP,
    InputOTPGroup,
    InputOTPSlot,
} from "@/components/ui/input-otp"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { RectangleEllipsis, CloudUpload, MessageCircle, UserPlus, CircleUserRound, UserRound, FolderOpen,Menu,ChevronsUpDown } from 'lucide-react'
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import useClientStore from "@/store/appStore"
import React,{ useEffect, useState } from "react"
import { useApiRequest } from "@/tools/request"
import { toast } from "sonner"
import { Outlet, useNavigate } from 'react-router-dom'

export default function AppWeb() {
    const { checkIsClient, setStoreData, closeWS } = useClientStore()
    const { request } = useApiRequest()
    const navigate = useNavigate();
    // 分享文件列表信息

    const [openAlert, setOpenAlert] = useState<boolean>(false)
    const [openUserDialog, setOpenUserDialog] = useState<boolean>(true)
    const [sharedCode, setSharedCode] = useState<string>("")
    const [userList, setUserList] = useState<any>([])
    const [optForUserIndex, setOptForUserIndex] = useState<number>(-1)
    const [addNewUser, setAddNewUser] = useState<boolean>(false)
    const [newUserName, setNewUserName] = useState<string>("")
    const [rememberUser, setRememberUser] = useState<boolean>(false)
    const [userInfo, setUserInfo] = useState<any>({})
    const [isLogin, setIsLogin] = useState<boolean>(false)
    const [activeMenu, setActiveMenu] = useState<string>("sharedDir")
    useEffect(() => {
        // web端设置为非客户端
        checkIsClient()
        initData()
        // 获取分享目录
        // getSharedDirInfo()
        // setUserList(['用户1', '用户2', '用户3'])
    }, [])

    const connectWSServer = () => {
        let userInfo:any = localStorage.getItem("rememberUserInfo")
        let token = localStorage.getItem("userToken")
        if (!token || !userInfo) return
        closeWS() // 关闭socket连接
        userInfo = JSON.parse(userInfo)
        let wsHandle = new WebSocket(`ws://192.168.53.183:4321/ws?ldToken=${token}&id=${userInfo.id}&name=${userInfo.name}`)
        setStoreData({name: "wsHandle", value: wsHandle})
    }
    const initData = () => {
        const token = localStorage.getItem("userToken")
        const rememberUser = localStorage.getItem("rememberUserInfo")
        const rememberUserInfoFlag = localStorage.getItem("rememberUserInfoFlag")
        console.log("rememberUserInfoFlag",!!rememberUserInfoFlag)
        setRememberUser(!!rememberUserInfoFlag)
        if (token && rememberUser && !!rememberUserInfoFlag) {
            document.cookie = `ldtoken=${token}; path=/;`
            setOpenUserDialog(false)
            setUserInfo(JSON.parse(rememberUser))
            setIsLogin(true)
        }
        connectWSServer()
        getUserList()
    }
    const getUserList = () => {
        request("/getUserList", 'POST', {}).then(res => {
            if (res?.code === 200) !!res.data && setUserList(res.data)
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

    const createUser = () => {
        if (newUserName === "") { toast.error("请输入用户名"); return }
        request("/createUser", 'POST', { userName: newUserName }).then(res => {
            if (res?.code === 200) {
                getUserList()
                setAddNewUser(false)
                setNewUserName("")
            } else {
                toast.error(res?.msg)
            }
        })
    }

    const getUserToken = (userId: number, userName: string) => {
        return request("/createToken", 'POST', { userId, userName })
    }
    // 选择用户
    const optForUserEvent = (e: any) => {
        if (isLogin) { // 已经登录过的关闭弹框清空数据
            setOpenUserDialog(false)
            setAddNewUser(false)
            setNewUserName("")
            return
        }
        // 未登录的情况
        if (optForUserIndex === -1) {
            toast.error("请选择用户")
            e.preventDefault();
        } else {
            changeUserEvent(optForUserIndex)
        }
    }

    // 更换用户
    const changeUserEvent = async (index: number) => {
        let userItem = userList[index]
        setUserInfo(userItem)
        setStoreData({name: "userInfo", value: {
            userId: userItem.id,
            userName: userItem.name,
            // userItem
        }})
        localStorage.setItem("rememberUserInfo", JSON.stringify(userItem))
        const tokenRes = await getUserToken(userItem.id, userItem.name) // 选择用户获取token
        localStorage.setItem("userToken", tokenRes.data.token)
        connectWSServer() // ws连接、重连
        if (rememberUser) {
            localStorage.setItem("rememberUserInfoFlag", "1")
        }
        setIsLogin(true) // 设置保持登录（已登录）
    }

    const unBindEvent = (item: any) => {
        request("/unBindUser", 'POST', { userId: item.id, userName: item.name }).then(res => {
            if (res.code === 200) {
                toast.success("解绑成功")
                getUserList()
            }
        })
    }

    const menuBtnEvent = (key: string) => {
        switch (key) {
            case "getSharedFile":
                setOpenAlert(true)
                break;
            case "userList":
                const currentUserIndex = userList.findIndex((item: any) => item.id === userInfo.id)
                setOptForUserIndex(currentUserIndex)
                setOpenUserDialog(true)
                break;
            case "toShare":
                navigate("/web/toShare")
                setActiveMenu(key)
                break;
            case "sharedDir":
                navigate("/web/sharedDir")
                setActiveMenu(key)
                break;
            case "chat":
                navigate("/web/chat")
                setActiveMenu(key)
                break;
            default:
        }
    }

    const btnList:any = [
        { key: 'sharedDir', name: "目录", icon: <FolderOpen size={25} />, tip: "客户端分享总目录" },
        { key: 'getSharedFile', name: "分享码", icon: <RectangleEllipsis size={25} />, tip: "通过分享码获取文件" },
        { key: 'toShare', name: "我要分享", icon: <CloudUpload size={25} />, tip: "我想发起文件分享，提供给其他人使用。【需要客户端授权】" },
        { key: 'chat', name: "消息", icon: <MessageCircle size={25} />, tip: "跟好友进行聊天" },
        { key: 'userList', name: "用户", icon: <CircleUserRound size={25} />, tip: "用户设置" },
    ]
    return <TooltipProvider>
        <div style={{ height: "100vh" }}>
            <AlertDialog open={openUserDialog} onOpenChange={setOpenUserDialog}>
                {/* <AlertDialogTrigger>Open</AlertDialogTrigger> */}
                <AlertDialogContent className="sm:w-full md:w-1/2 h-3/5 flex flex-col justify-between gap-0">
                    <AlertDialogHeader className="h-4/5">
                        <AlertDialogTitle className="text-center">{!isLogin ? '请选择您的账户' : '修改账户信息'}</AlertDialogTitle>
                        <AlertDialogDescription asChild>
                            <div className="flex flex-col justify-start h-4/5 overflow-auto p-2">
                                {
                                    userList.map((item: any, index: number) => (
                                        <Card className={`w-full mb-2 cursor-pointer border-2 ${optForUserIndex === index && 'border-[#0f172a] bg-gray-200'}`} key={`${item.id}-${item.name}`} onClick={() => !isLogin && setOptForUserIndex(index)}>
                                            <CardContent className="flex item-center justify-between p-3">
                                                <div className="flex item-center">
                                                    <Avatar>
                                                        <AvatarFallback>
                                                            <UserRound />
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <span className="leading-10 ml-4">{item.name}</span>
                                                </div>
                                                {
                                                    optForUserIndex !== index && isLogin && <div className="flex">
                                                        <Button variant={"default"} className="ml-2" onClick={() => { setOptForUserIndex(index); changeUserEvent(index); }}>切换</Button>
                                                        <Button variant={"destructive"} className="ml-2" onClick={(e) => { e.preventDefault(); e.stopPropagation(); unBindEvent(item); }}>解绑</Button>
                                                    </div>
                                                }
                                            </CardContent>
                                        </Card>
                                    ))
                                }
                                <Card className="w-full border-dashed border-2">
                                    <CardContent className="flex justify-center item-center p-3">
                                        {
                                            addNewUser && <div className="flex w-full items-center">
                                                <span className="w-24">用户名</span>
                                                <Input value={newUserName} onChange={(val) => { setNewUserName(val.target.value) }}></Input>
                                                <Button className="ml-2" onClick={() => createUser()}>新增</Button>
                                            </div>
                                        }
                                        {
                                            !addNewUser && <div className="flex flex-col justify-center items-center cursor-pointer" onClick={() => setAddNewUser(true)}>
                                                <UserPlus />
                                                <span className="text-xs">新增一个用户</span>
                                            </div>
                                        }

                                    </CardContent>
                                </Card>
                            </div>
                        </AlertDialogDescription>

                    </AlertDialogHeader>
                    <AlertDialogFooter className="flex !flex-col !justify-center">
                        <p className="text-xs flex items-center p-4">
                            <Checkbox checked={rememberUser} onCheckedChange={(val: boolean) => setRememberUser(val)} />
                            <span className="ml-4 text-gray-500">记住用户【下一次将默认选中该账户信息】</span>
                        </p>
                        <AlertDialogAction onClick={(e) => optForUserEvent(e)}>{!isLogin ? '确认' : '关闭'}</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            <AlertDialog open={openAlert} onOpenChange={setOpenAlert}>
                {/* <AlertDialogTrigger>Open</AlertDialogTrigger> */}
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-center">请输入分享码</AlertDialogTitle>
                        <AlertDialogDescription asChild >
                            <div className="flex justify-center py-8">
                                <InputOTP maxLength={6} value={sharedCode} onChange={(value) => { setSharedCode(value) }}>
                                    <InputOTPGroup>
                                        <InputOTPSlot index={0} className="h-16 w-14 border-2" />
                                        <InputOTPSlot index={1} className="h-16 w-14 border-2 border-l-0 border-r-0" />
                                        <InputOTPSlot index={2} className="h-16 w-14 border-2" />
                                        <InputOTPSlot index={3} className="h-16 w-14 border-2 border-l-0 border-r-0" />
                                        <InputOTPSlot index={4} className="h-16 w-14 border-2" />
                                        <InputOTPSlot index={5} className="h-16 w-14 border-2 border-l-0" />
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
            <div className="flex" style={{ height: "95vh", borderBottomWidth: '1px' }}>
                <div className="w-20 hidden sm:block pt-10" style={{ borderRightWidth: '1px' }}>
                    {
                        btnList.map((item:any) => (
                            <Tooltip key={item.key}>
                                <TooltipTrigger asChild>
                                    <div className="flex flex-col justify-center items-center cursor-pointer hover:bg-gray-100 py-4" onClick={() => menuBtnEvent(item.key)}>
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
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <div className="w-20 block sm:hidden fixed top-2 left-2 z-10">
                            <Button variant="outline" className="p-2">
                                <Menu size={15}/>
                                <span className="mx-4">{btnList.find((item:any)=> (item.key === activeMenu)).name}</span>
                                <ChevronsUpDown size={15} />
                                </Button>
                        </div>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-32" align="start">
                        {
                            btnList.map((item:any) => (<DropdownMenuItem key={"dropdown-menu-" + item.key} onClick={() => menuBtnEvent(item.key)}>
                                {React.cloneElement(item.icon, {size: 15, strokeWidth:1})}
                                <span className="text-xs">{item.name}</span>
                            </DropdownMenuItem>))
                        }
                    </DropdownMenuContent>
                </DropdownMenu>
                <Outlet/>
            </div>
            <div style={{ height: "5vh" }}>
            </div>
        </div>
    </TooltipProvider>
}