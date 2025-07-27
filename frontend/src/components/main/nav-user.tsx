import { UserRound, LogOutIcon, MoreVerticalIcon, PenLine, Pen, CheckLine } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { userAvatar } from "@/app/commonData"
import { forwardRef, useEffect, useImperativeHandle, useState } from "react"
import { Button } from "@/components/ui/button"
import useStore from "@/store/appStore"
import { Input } from "@/components/ui/input"
import { useApiRequest } from "@/tools/request"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { AppLoginForm } from "./app-login"
interface NavUserRef {
    closeLoginDialog: () => void;
}

const NavUser = forwardRef<NavUserRef,{loginEvent?: (adminId: string,adminPwd: string) => void}>(({loginEvent}, ref) => {
  const { userInfo } = useStore()
  const { request } = useApiRequest()
  const { isMobile } = useSidebar()
  const [userData, setUserData] = useState<{
    nickName: string
    id: string
    avatar: string
    role: string
  }>({
    nickName: userInfo.nickName,
    id: userInfo.userId,
    avatar: userInfo.avatar,
    role: userInfo.role
  })
  const [isChange, setIsChange] = useState<boolean>(false)
  const [changeName, setChangeName] = useState<boolean>(false)
  const [openAppLogin, setOpenAppLogin] = useState<boolean>(false)

  useEffect(() => {
    setUserData({
      nickName: userInfo.nickName,
      id: userInfo.userId,
      avatar: userInfo.avatar,
      role: userInfo.role
    })
  }, [userInfo])

  useImperativeHandle(ref, ()=> ({
    closeLoginDialog: ()=> {
      setOpenAppLogin(false)
    }
  }))
  const changeUserAvatar = (avatar: string) => {
    setIsChange(true)
    setUserData({
      ...userData,
      avatar
    })
  }
  const updateUserInfo = () => {
    request("/updateUserInfo", 'POST', userData).then(res => {
      if (res.code === 200) {
        toast.success("更新成功")
        setIsChange(false)
      }
    })
  }
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar>
                <AvatarFallback className="cursor-pointer text-xl">
                  {userData.avatar || <UserRound />}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{userData.nickName}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {(userData.role === 'admin' || userData.role === "admin+") ? "管理员" : "普通用户"}
                </span>
              </div>
              <MoreVerticalIcon className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Popover>
                  <PopoverTrigger asChild>
                    <div className="relative cursor-pointer">
                      <Avatar>
                        <AvatarFallback className="text-xl">
                          {userData.avatar || <UserRound />}
                        </AvatarFallback>
                      </Avatar>
                      <div className="absolute bottom-0 right-0 p-[4px] bg-primary text-white rounded shadow">
                        <Pen size={10} />
                      </div>
                    </div>
                  </PopoverTrigger>
                  <PopoverContent className="flex flex-wrap gap-2 min-w-[32rem]">
                    {
                      userAvatar.map((item: string) => (
                        <p className="text-3xl p-2 cursor-pointer hover:bg-slate-100" key={item} onClick={() => changeUserAvatar(item)}>{item}</p>
                      ))
                    }
                  </PopoverContent>
                </Popover>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <div className="flex justify-between items-center">
                    {
                      changeName ?
                        <Input maxLength={8} className="mr-2 h-8" onBlur={() => setChangeName(false)} onChange={(e) => (setUserData(prev => ({ ...prev, nickName: e.target.value })))} />
                        :
                        <span className="truncate font-medium h-8 leading-8">{userData.nickName}</span>
                    }
                    <Button size="sm" variant="default" className="px-2 py-2 text-xs h-6 p-2" onClick={() => setChangeName(changeName ? false : true)} >
                      {changeName ? <CheckLine size={15} /> : <PenLine size={15} />}
                    </Button>
                  </div>
                  <div className="flex justify-between items-center mt-2">
                    <span className="truncate text-xs text-muted-foreground">{(userData.role === 'admin' || userData.role === "admin+") ? "管理员" : "普通用户"}</span>
                    {isChange && <Button size="sm" className="px-2 text-xs h-6" onClick={() => updateUserInfo()}>更新</Button>}
                  </div>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={()=> setOpenAppLogin(true)}>
              <LogOutIcon />
              切换账户
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
      <Dialog open={openAppLogin} onOpenChange={setOpenAppLogin}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle></DialogTitle>
            <DialogDescription asChild>
              <AppLoginForm loginEvent={loginEvent}/>
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </SidebarMenu>
  )
})
export {
  NavUser
}
export type { NavUserRef }
