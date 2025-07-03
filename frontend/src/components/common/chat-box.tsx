import * as React from "react"
import { Check, Send, Bell, UserRoundPlus } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Avatar,
  AvatarFallback
} from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

import useClientStore from "@/store/appStore"

export default function ChatBox() {
  const { wsHandle, userInfo } = useClientStore()
  const [open, setOpen] = React.useState(false)
  const [selectedUsers, setSelectedUsers] = React.useState<any>([])
  const [chatUser, setChatUser] = React.useState<any>(null)
  const [chatUserList, setChatUserList] = React.useState<any>([])
  const [messages, setMessages] = React.useState<any>([])
  const [input, setInput] = React.useState("")
  const [users, setUsers] = React.useState<any>([])
  const inputLength = input.trim().length
  React.useEffect(() => {
    if (wsHandle) {
      wsHandle.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.type === "chatReceiveData") {
          setMessages((prevMessages: any) => [...prevMessages, { user: msg.content.from, message: msg.content.message }]);
        } else if (msg.type === "clientList") {
          console.log("msg.content", msg.content)
          setUsers(msg.content)
        } else if (msg.type === "userData") {
          console.log("获取初始化数据")
        }
      };
    }
  }, [])
  const sendData = (message: string) => {
    wsHandle?.send(JSON.stringify({
      type: "chatSendData",
      content: {
        to: chatUser?.clientID,
        from: userInfo.userName,
        message
      },
    }))
  };
  const getClientList = () => {
    wsHandle?.send(JSON.stringify({
      type: "queryClients",
      content: {
        userId: userInfo.userId
      },
    }))
  }

  return (
    <div className="flex h-full">
      <div className="w-64">
        <Card className="p-2 h-full border-0 rounded-none">
          <div className="flex gap-2 justify-end">
            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="sm" variant="ghost" className="relative px-0" onClick={() => { getClientList(); setOpen(true); }}>
                    <Bell />
                    <p className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded"></p>
                  </Button>
                </TooltipTrigger>
                <TooltipContent sideOffset={10}>通知</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="sm" variant="ghost" className="relative px-0" onClick={() => { getClientList(); setOpen(true); }}>
                    <UserRoundPlus />
                  </Button>
                </TooltipTrigger>
                <TooltipContent sideOffset={10}>添加用户</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <Input className="my-2" placeholder="搜索我的好友"></Input>
          <div>
            {
              chatUserList.map((item: any) => {
                return <div className="p-4">
                  {item.name}
                </div>
              })
            }
          </div>
        </Card>
      </div>
      <Card className="h-full flex flex-col justify-between border-0 rounded-none border-l-[1px]" style={{width: "calc(100% - 16rem)"}}>
        <CardHeader className="flex flex-row items-center h-14 p-2">
          <div className="flex items-center space-x-4">
            <Avatar>
              <AvatarFallback>{chatUser?.name.slice(0, 2)}</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-medium leading-none">{chatUser?.name}</p>
              <p className="text-sm text-muted-foreground">{chatUser?.type}</p>
            </div>
          </div>

        </CardHeader>
        <CardContent className="pb-0 mb-4 overflow-y-auto max-h-[310px] ">
          <div className="space-y-4">
            {messages.map((message: any, index: number) => (
              <div
                key={index}
                className={cn(
                  "flex max-w-[75%] flex-col gap-2 rounded-lg px-3 py-2 text-sm",
                  message.user === userInfo.userName
                    ? "ml-auto bg-primary text-primary-foreground"
                    : "bg-muted"
                )}
              >
                {message.message}
              </div>
            ))}
          </div>
        </CardContent>
        <CardFooter className="p-2 pt-0 pb-4">
          <form
            onSubmit={(event) => {
              event.preventDefault()
              if (inputLength === 0) return
              setMessages([
                ...messages,
                {
                  user: userInfo.userName,
                  message: input,
                },
              ])
              sendData(input)
              setInput("")
            }}
            className="flex w-full items-center space-x-2"
          >
            <Textarea
              id="message"
              className="flex-1 resize-none"
              autoComplete="off"
              value={input}
              onChange={(event) => setInput(event.target.value)}
            />
            <Button type="submit" size="icon" disabled={inputLength === 0}>
              <Send />
            </Button>
          </form>
        </CardFooter>
      </Card>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="gap-0 p-0 outline-none">
          <DialogHeader className="px-4 pb-4 pt-5">
            <DialogTitle>查询在线用户</DialogTitle>
            <DialogDescription>您可以选择用户进行聊天</DialogDescription>
          </DialogHeader>
          <Command className="overflow-hidden rounded-t-none border-t bg-transparent">
            <CommandInput placeholder="搜索用户..." />
            <CommandList>
              <CommandEmpty>当前没有活跃用户。</CommandEmpty>
              <CommandGroup className="p-2">
                {users.map((user: any) => (
                  <CommandItem
                    key={user.id}
                    className="flex items-center px-2"
                    onSelect={() => {
                      if (selectedUsers.includes(user)) {
                        return setSelectedUsers(
                          selectedUsers.filter(
                            (selectedUser: any) => selectedUser !== user
                          )
                        )
                      }
                      return setSelectedUsers(
                        [...users].filter((u) =>
                          [...selectedUsers, user].includes(u)
                        )
                      )
                    }}
                  >
                    <Avatar>
                      <AvatarFallback>{user.name[0]}</AvatarFallback>
                    </Avatar>
                    <div className="ml-2">
                      <p className="text-sm font-medium leading-none">
                        {user.name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {user.type === 'admin' ? "管理员" : "普通用户"}
                      </p>
                    </div>
                    {selectedUsers.includes(user) ? (
                      <Check className="ml-auto flex h-5 w-5 text-primary" />
                    ) : null}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
          <DialogFooter className="flex items-center border-t p-4 !flex-row justify-between">
            {selectedUsers.length > 0 ? (
              <div className="flex -space-x-2 overflow-hidden">
                {selectedUsers.map((user: any) => (
                  <Avatar
                    key={user.id}
                    className="inline-block border-2 border-background"
                  >
                    <AvatarFallback>{user.name[0]}</AvatarFallback>
                  </Avatar>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">请选择需要发送私信的用户。（目前只支持单聊）</p>
            )}
            <Button
              disabled={selectedUsers.length !== 1}
              onClick={() => {
                setOpen(false)
                // console.log(selectedUsers)
                setChatUser(selectedUsers[0])
                setChatUserList([...chatUserList, ...selectedUsers])
              }}
            >添加为好友</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}