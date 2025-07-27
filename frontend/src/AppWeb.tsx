import { TooltipProvider, Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Card, CardContent } from "@/components/ui/card"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { RectangleEllipsis, CloudUpload, MessageCircle, UserPlus, CircleUserRound, UserRound, FolderOpen, Menu, ChevronsUpDown } from 'lucide-react'
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import useStore from "@/store/appStore"
import React, { useEffect, useState, useCallback, useRef } from "react"
import { useApiRequest } from "@/tools/request"
import { toast } from "sonner"
import { Outlet, useNavigate } from 'react-router-dom'
import { userAvatar } from "@/app/commonData"
import { useWebSocket } from "@/hooks/useWebSocket"
import { useLocation } from "react-router-dom"
export default function AppWeb() {
    const { checkIsClient, setStoreData, closeWS, validExpToken, userInfo, wsHandle, redDotCount } = useStore()
    const { pathname } = useLocation()
    const { request } = useApiRequest()
    const navigate = useNavigate()
    const { sendMessage } = useWebSocket()
    // 分享文件列表信息
    const [openAlert, setOpenAlert] = useState<boolean>(false)
    const [openUserDialog, setOpenUserDialog] = useState<boolean>(true)
    const [sharedCode, setSharedCode] = useState<string>("")
    const [userList, setUserList] = useState<any>([])
    const [optForUserId, setOptForUserId] = useState<number>(-1)
    const [addNewUser, setAddNewUser] = useState<boolean>(false)
    const [newUserName, setNewUserName] = useState<string>("")
    const [rememberUser, setRememberUser] = useState<boolean>(false)
    const [isLogin, setIsLogin] = useState<boolean>(false)
    const [activeMenu, setActiveMenu] = useState<string>("sharedDir")
    const socketList = useRef<Array<any>>([])
    const timeoutHandle = useRef<any>(null)
    const currentUserId = useRef<number>(-1)
    const [trigger, setTrigger] = useState<boolean>(false)
    useEffect(() => {
        // web端设置为非客户端
        checkIsClient()
        initData()
        return () => {
            closeWS() // 关闭socket连接
        }
    }, [])
    useEffect(() => {
        // web端设置为非客户端
        if (optForUserId > 0 && isLogin) changeUserEvent(optForUserId)
    }, [optForUserId])

    useEffect(() => {
        if (validExpToken) {
            setIsLogin(false)
            setOptForUserId(+userInfo.userId)
            setOpenUserDialog(true)
        }
    }, [validExpToken])

    useEffect(() => {
        sendMessage({ type: "getNotifyRedDotData" })
    }, [wsHandle, trigger])

    // 异步传递socket信息，将socket的信息暂存socketList，在100s内进行更新
    const setSocketQueue = useCallback(() => {
        if (!!timeoutHandle.current) return
        timeoutHandle.current = setTimeout(() => {
            const currentList = [...socketList.current]
            socketList.current = []
            setStoreData({
                before: (store, set) => {
                    set({ socketQueue: [...store.socketQueue, ...currentList] })
                }
            })
            timeoutHandle.current = null
        }, (Math.random() * 100)) // 设置更新为100秒的延迟
    }, [])

    const connectWSServer = (token: string, userInfo: any) => { // 连接socket
        return new Promise(resolve => {
            if (!token || !userInfo) {
                console.warn("缺少关键参数")
                return resolve(-1)
            }
            let wsHandle = new WebSocket(`ws://${location.hostname}:4321/ws?ldToken=${token}&id=${userInfo.id}&name=${userInfo.name}`)
            wsHandle.onmessage = (event) => {
                const info = JSON.parse(event.data);
                if (info.type === "replyNotifyRedDotData") { // 红点数据拦截进行全局监听
                    console.log("replyNotifyRedDotData", info.content)
                    setStoreData({
                        before: (_, set) => {
                            set({
                                redDotCount: info.content.data.totalCount,
                                redDotList: info.content.data.redDotList
                            })
                        }
                    })
                } else {
                    if (["replyChatReceiveData", "replyAddFriends", "replyDealWithFriends", "replyLatestFriendList"].includes(info.type)) {
                        setTrigger(pre => !pre)    
                    }
                    socketList.current.push(info)
                    setSocketQueue()
                }
            }
            wsHandle.onopen = () => {
                setStoreData({ wsHandle })
                resolve(wsHandle.readyState);
            }
            wsHandle.onerror = () => {
                console.warn("socket连接出错了。")
                resolve(wsHandle.readyState);
            }
        })

    }
    const initData = async () => { // 初始化数据
        await getUserList()
        // const token = localStorage.getItem("userToken") || ""
        const rememberUser = localStorage.getItem("rememberUserInfo")
        const rememberUserInfoFlag = localStorage.getItem("rememberUserInfoFlag")
        let userInfoData = rememberUser && JSON.parse(rememberUser)
        setRememberUser(!!rememberUserInfoFlag)
        if (userInfo.token && rememberUser && !!rememberUserInfoFlag) {
            setOpenUserDialog(false)
            setIsLogin(true)
        }
        userInfoData && setOptForUserId(userInfoData.id)
        currentUserId.current = userInfoData && userInfoData.id
    }
    const getUserList = () => { // 获取用户列表
        return new Promise((reslove) => {
            request("/getUserList", 'POST', {}).then(res => {
                if (res?.code === 200) !!res.data && setUserList(res.data.map((item: any) => ({ ...item, isChange: false })))
                reslove(res)
            })
        })
    }
    const getRealFilePath = () => { // 获取真实文件路径
        request("/getRealFilePath?fileCode=" + sharedCode).then(res => {
            if (res?.code === 200) {
                // console.log(res.data)
                setSharedCode("")
            }
        })
    }

    const createUser = () => { // 创建用户
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

    const getUserToken = (userId: number, userName: string) => { // 获取用户token
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
        if (optForUserId === -1) {
            toast.error("请选择用户")
            e.preventDefault();
        } else {
            changeUserEvent(optForUserId)
            setIsLogin(true)
        }
    }

    // 更换用户
    const changeUserEvent = async (checkId: number) => {
        currentUserId.current = -1
        await closeWS()
        if (!userList || userList.length === 0) {
            setOpenUserDialog(true)
            setIsLogin(false)
            localStorage.removeItem("rememberUserInfo")
            setStoreData({
                before: (_, set) => {
                    set({
                        userInfo: {
                            token: "",
                            userName: "",
                            nickName: "",
                            userId: "",
                            role: "",
                            avatar: "",
                            userPwd: "",
                        }
                    })
                },
            })
            return
        }
        let userItem = userList.find((item: any) => item.id === checkId)
        let token = userInfo.token
        localStorage.setItem("rememberUserInfo", JSON.stringify(userItem)) // 设置用户信息
        if (userItem.id !== userInfo.userId) {
            console.log("不是当前用户，重新请求")
            const tokenRes = await getUserToken(userItem.id, userItem.name) // 选择用户获取token
            token = tokenRes.data.token
        }
        // localStorage.setItem("userToken", tokenRes.data.token) // 设置用户token
        setStoreData({
            before: (store, set) => {
                set({
                    userInfo: {
                        ...store.userInfo,
                        userId: userItem.id,
                        userName: userItem.name,
                        token,
                    }
                })
            }
        })
        await connectWSServer(token, userItem) // ws连接、重连
        if (rememberUser) {
            localStorage.setItem("rememberUserInfoFlag", "1")
        }
        // if (isLogin) {
        setOptForUserId(checkId) // 设置选中的用户
        currentUserId.current = checkId
        // }
    }

    const unBindEvent = (item: any) => { // 解绑设备
        request("/unBindUser", 'POST', { userId: item.id, userName: item.name }).then(res => {
            if (res.code === 200) {
                toast.success("解绑成功")
                getUserList()
            }
        })
    }
    const changeUserAvatar = (avatar: string, index: number, isChange: boolean) => { // 更换用户头像
        let newUserList = userList.map((item: any, i: number) => i === index ? { ...item, isChange, avatar } : item)
        setUserList(newUserList)
    }

    const updateUserInfo = (item: any, index: number, isChange: boolean) => {
        let newUserList = userList.map((item: any, i: number) => i === index ? { ...item, isChange } : item)
        setUserList(newUserList)
        request("/updateUserInfo", 'POST', { ...item }).then(res => {
            if (res.code === 200) {
                toast.success("更新成功")
            }
        })
    }

    const menuBtnEvent = (key: string) => {
        switch (key) {
            case "getSharedFile":
                setOpenAlert(true)
                break;
            case "userList":
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

    const btnList: any = [
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
                                        <Card className={`relative w-full mb-2 cursor-pointer border-2 ${optForUserId === item.id && 'border-[#0f172a] bg-gray-200'}`} key={`${item.id}-${item.name}`} onClick={() => { !isLogin && setOptForUserId(item.id); currentUserId.current = item.id; }}>
                                            <CardContent className="flex item-center justify-between p-3">
                                                <div className="flex item-center">
                                                    <Popover>
                                                        <PopoverTrigger asChild>
                                                            <Avatar onClick={(e) => !isLogin && e.preventDefault()}>
                                                                <AvatarFallback className="text-xl">
                                                                    {item.avatar || <UserRound />}
                                                                </AvatarFallback>
                                                            </Avatar>
                                                        </PopoverTrigger>
                                                        <PopoverContent className="flex flex-wrap gap-2 w-[100vw] sm:max-w-[32rem]">
                                                            {
                                                                userAvatar.map((item: string) => (
                                                                    <p className="text-3xl p-2 cursor-pointer hover:bg-slate-100" key={item} onClick={() => changeUserAvatar(item, index, true)}>{item}</p>
                                                                ))
                                                            }
                                                        </PopoverContent>
                                                    </Popover>
                                                    <span className="leading-10 ml-4">{item.nickName}</span>
                                                </div>
                                                {
                                                    optForUserId !== index && isLogin && <div className="flex">
                                                        {
                                                            item.isChange && <Button variant={"default"} className="ml-2" onClick={() => { updateUserInfo(item, index, false) }}>更新头像</Button>
                                                        }
                                                        {
                                                            optForUserId !== item.id && <>
                                                                <Button variant={"default"} className="ml-2" onClick={() => { setOptForUserId(item.id) }}>切换</Button>
                                                                <Button variant={"destructive"} className="ml-2" onClick={(e) => { e.preventDefault(); e.stopPropagation(); unBindEvent(item); }}>解绑</Button>
                                                            </>
                                                        }
                                                    </div>
                                                }
                                            </CardContent>
                                            {
                                                (userInfo.userId === item.id && validExpToken) && <p className="absolute bottom-1 right-2 text-xs text-red-300">当前账号登录已经失效，请重新登录</p>
                                            }
                                        </Card>
                                    ))
                                }
                                <Card className="w-full border-dashed border-2">
                                    <CardContent className="flex justify-center item-center p-3">
                                        {
                                            addNewUser && <div className="flex w-full items-center">
                                                <span className="w-24">用户名</span>
                                                <Input value={newUserName} maxLength={8} onChange={(val) => { setNewUserName(val.target.value) }}></Input>
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
                <div className="w-20 h-[95vh] fixed left-0 top-0 hidden sm:block pt-10" style={{ borderRightWidth: '1px' }}>
                    {
                        btnList.map((item: any) => (
                            <Tooltip key={item.key}>
                                <TooltipTrigger asChild>
                                    <div className={`flex flex-col justify-center items-center cursor-pointer hover:bg-gray-100 py-4 relative ${pathname.split('/').pop() === item.key ? "bg-zinc-300":""}`} onClick={() => menuBtnEvent(item.key)}>
                                        {item.icon}
                                        <span className="text-xs">{item.name}</span>
                                        {
                                            redDotCount > 0 && item.key==="chat" && <p className="text-xs absolute top-2 right-2 bg-red-500 rounded px-[3px] text-white">{redDotCount}</p>
                                        }
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
                                <Menu size={15} />
                                <span className="mx-4">{btnList.find((item: any) => (item.key === activeMenu)).name}</span>
                                <ChevronsUpDown size={15} />
                            </Button>
                        </div>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-32" align="start">
                        {
                            btnList.map((item: any) => (<DropdownMenuItem key={"dropdown-menu-" + item.key} onClick={() => menuBtnEvent(item.key)}>
                                {React.cloneElement(item.icon, { size: 15, strokeWidth: 1 })}
                                <span className="text-xs">{item.name}</span>
                            </DropdownMenuItem>))
                        }
                    </DropdownMenuContent>
                </DropdownMenu>
                <Outlet context={{ userId: currentUserId.current }} />
            </div>
            <div style={{ height: "5vh" }}>
            </div>
        </div>
    </TooltipProvider>
}