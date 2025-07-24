import { MailIcon, PlusCircleIcon, Copy, type LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Link } from 'react-router-dom'
import { OpenDirectory } from "@clientSDK/App"
import React, { } from 'react'
import useClientStore from "@/store/appStore"
export function NavMain({
  items,
  path
}: {
  items: {
    title: string
    path: string
    icon?: LucideIcon
  }[],
  path: string
}) {
  const { redDotCount } = useClientStore()
  const [dirPath, setDirPath] = React.useState("")
  const openDirectory = () => {
    OpenDirectory().then(res => {
      console.log(res)
      setDirPath(res.dir)
    }).catch(err => {
      console.log(err)
    })
  }
  return (
    <SidebarGroup>
      <SidebarGroupContent className="flex flex-col gap-2">
        <SidebarMenu>
          <SidebarMenuItem className="flex items-center gap-2">
            <Dialog>
              <DialogTrigger asChild>
                <SidebarMenuButton
                  tooltip="快速分享"
                  className="min-w-8 bg-primary text-primary-foreground duration-200 ease-linear hover:bg-primary/90 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground"
                // onClick={openDirectory}
                >
                  <PlusCircleIcon />
                  <span>快速分享</span>
                </SidebarMenuButton>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>快速分享</DialogTitle>
                  <DialogDescription>
                    请选择分享的文件夹或者<del>文件</del>[目前暂不支持单文件]
                  </DialogDescription>
                </DialogHeader>
                <div className="flex items-center space-x-2">
                  <div className="grid flex-1 gap-2">
                    <Input
                      id="link"
                      // defaultValue="https://ui.shadcn.com/docs/installation"
                      readOnly
                      value={dirPath}
                    />
                  </div>
                  <Button type="submit" size="sm" className="px-3" onClick={openDirectory}>
                    <Copy />
                  </Button>
                </div>
                <DialogFooter className="sm:justify-start">
                  <DialogClose asChild>
                    <Button type="button" variant="secondary">
                      关闭
                    </Button>
                  </DialogClose>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button
              size="icon"
              className="h-9 w-9 shrink-0 group-data-[collapsible=icon]:opacity-0"
              variant="outline"
            >
              <Link to={"chat"}>
                <MailIcon />
                {
                  redDotCount > 0 && <p className="text-xs absolute top-[-5px] right-[-5px] bg-red-500 rounded px-[3px] text-white">{redDotCount}</p>
                }
              </Link>
            </Button>
          </SidebarMenuItem>
        </SidebarMenu>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton asChild tooltip={item.title} className={`${path === item.path ? 'bg-zinc-300' : ''}`}>
                <Link to={item.path}>
                  {item.icon && <item.icon />}
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
