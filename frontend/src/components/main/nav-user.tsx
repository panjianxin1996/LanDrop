import {
  UserRound,
  LogOutIcon,
  MoreVerticalIcon,
  SquarePen
} from "lucide-react"
import {
  Avatar,
  AvatarFallback,
  // AvatarImage,
} from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  // DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { userAvatar } from "@/app/commonData"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import useClientStore from "@/store/appStore"
import { Input } from "../ui/input"

export function NavUser() {
  const { userInfo } = useClientStore()
  const { isMobile } = useSidebar()
  const [userData, setUserData] = useState<{
    name: string
    id: string
    avatar: string
    role: string
  }>({
    name: userInfo.userName,
    id: userInfo.userId,
    avatar: userInfo.avatar,
    role: userInfo.role
  })

  const [isChange, setIsChange] = useState<boolean>(false)
  const [changeName, setChangeName] = useState<boolean>(false)
  const changeUserAvatar = (avatar: string) => {
    setIsChange(true)
    setUserData({
      ...userData,
      avatar
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
                <span className="truncate font-medium">{userData.name}</span>
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
                      <div className="absolute bottom-0 right-0 p-[2px] bg-white rounded shadow">
                        <SquarePen size={15} />
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
                  <div className="flex  justify-between items-center">
                    {
                      changeName ?
                        <Input maxLength={8} className="mr-2"  onChange={(e) => {
                          console.log(e,"===")
                          setUserData(prev => ({
                            ...prev,
                            name: e.target.value
                          }));
                        }} />
                        :
                        <span className="truncate font-medium">{userData.name}</span>
                    }

                    <Button size="sm" variant="outline" className="px-2 text-xs h-6" onClick={() => setChangeName(true)}>
                      <SquarePen size={15} />
                    </Button>
                  </div>
                  <div className="flex justify-between items-center mt-2">
                    <span className="truncate text-xs text-muted-foreground">{(userData.role === 'admin' || userData.role === "admin+") ? "管理员" : "普通用户"}</span>
                    {isChange && <Button size="sm" className="px-2 text-xs h-6">更新</Button>}
                  </div>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <LogOutIcon />
              切换账户
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
