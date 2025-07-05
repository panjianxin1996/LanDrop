import * as React from "react"
import { Check, Send, Bell, UserRoundPlus, CircleCheck, CircleX } from "lucide-react"
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import useClientStore from "@/store/appStore"

type WebMsg = {
  sId?: string,
  type: string,
  content?: any,
  user?: any,
  sendData?: any,
}

export default function ChatBox() {
  const { wsHandle, userInfo } = useClientStore()
  const [clientData, setClientData] = React.useState<any>({}) // 当前设备数据，包含了设备信息以及离线情况设备消息、通知
  const [open, setOpen] = React.useState(false)
  const [selectedUsers, setSelectedUsers] = React.useState<any>([])
  // @ts-ignore
  const [chatUser, setChatUser] = React.useState<any>(null) // 聊天中的好友
  const [chatUserList, setChatUserList] = React.useState<any>([]) //左侧好友列表
  const [messages, setMessages] = React.useState<any>({})
  const [input, setInput] = React.useState("")
  const [users, setUsers] = React.useState<any>([])
  const [notifyList, setNotifyList] = React.useState<any>([])
  const chatUserRef = React.useRef(chatUser) // 为了方便onMessage中获取最新的chatUser
  const inputLength = input.trim().length
  React.useEffect(() => {
    chatUserRef.current = chatUser;
  }, [chatUser]);
  React.useEffect(() => {
    if (wsHandle) {
      sendMessage({ type: "pullData" }) // 获取初始数据
      queryFriendList()
      wsHandle.onmessage = (event) => {
        const m = JSON.parse(event.data);
        const ty = m.type;
        const content = m.content;
        if (ty === "replyChatReceiveData") { // 接受聊天数据
          if (content.code === 1 && !!content.data) {
            receiveChatRecords(content.data)
          }
        } else if (ty === "replyClientList") { // 获取用户列表
          if (content.data) setUsers(content.data)
        } else if (ty === "replyAddFriends") { // 用户被添加好友监听
          if (content.code === 1) setNotifyList([...notifyList, content.data])
        } else if (ty === "replyPullData") { // 获取初始化数据,包含当前设备信息以及设备待处理的数据,消息,通知等数据
          setClientData(content)
          if (content.notifyList && Array.isArray(content.notifyList)) {
            setNotifyList(content.notifyList)
          }
        } else if (ty === "replyDealWithFriends") { // 处理好友请求
          if (content.code === 1 && content.fId) {
            setNotifyList(notifyList.filter((item: any) => item.fId === content.fId))
            queryFriendList()
          }
        } else if (ty === "replyFriendList") { // 好友列表
          if (content.code === 1 && content.data) {
            setChatUserList(content.data)
            let messageList: any = {}
            content.data.forEach((item: any) => (messageList[`${item.friendName}#${item.friendId}`] = []))
            setMessages(messageList)
          }
        } else if (ty === "replyChatRecords") { // 聊天记录
          if (content.code === 1 && content.data) {
            const chatUser = chatUserRef.current;
            let clientID = `${chatUser.friendName}#${chatUser.friendId}`
            setMessages((prev: any) => ({
              ...prev,
              [clientID]: content.data
            }))
          }
        } else if (ty === "commonError") { // 监听错误
          console.warn("监听到ws处理错误", content.error)
        }
      };
    }
  }, [])

  const sendMessage = (webMsg: WebMsg) => { // 封装socket发送
    if (!userInfo.userId || !userInfo.userName) {
      console.warn("发送消息失败，未获取到用户信息。。。")
      return
    }
    if (!wsHandle) {
      console.warn("发送消息失败，socket连接断开。。。")
      return
    }
    const { sId, type, sendData, content, user } = webMsg
    let timeStamp = new Date().getTime()
    let clientType = "LD_WEB"
    let initUser = user || { userId: userInfo.userId, userName: userInfo.userName }
    let initContent = content || {}
    let webSendData = { sId: sId || `LD_${timeStamp}`, type, sendData, content: initContent, user: initUser, timeStamp, clientType }
    wsHandle.send(JSON.stringify(webSendData))
  }
  const sendData = (message: string) => { // 发送聊天信息
    let clientID = `${chatUser.friendName}#${chatUser.friendId}`
    setMessages((prev: any) => ({
      ...prev,
      [clientID]: [...prev[clientID], { fromId: userInfo.userId, message }]
    }))
    sendMessage({
      type: "chatSendData",
      sendData: {
        to: clientID,
        toId: chatUser.friendId,
        from: userInfo.userName,
        fromId: userInfo.userId,
        message
      }
    })
  };
  const getClientList = () => { // 查询客户端列表
    sendMessage({ type: "queryClients" })
  }

  const dealWithFriendsRequest = (status: string, nItem: any) => { // 处理好友请求
    sendMessage({
      type: "dealWithFriendsRequest", sendData: {
        ...nItem,
        status,
      }
    })
  }

  const addFriends = () => { // 添加好友
    let friend = selectedUsers[0] // 只能当选默认第一条
    sendMessage({
      type: "addFriends", sendData: {
        to: friend.clientID,
        toId: friend.id,
        toName: friend.name,
        from: clientData.clientID,
        fromId: clientData.id,
        fromName: clientData.name,
      }
    })
  }

  const queryFriendList = () => { // 查询好友列表
    sendMessage({ type: "queryFriendList" })
  }

  const receiveChatRecords = (data: any) => {
    let msg = data[0]
    let clientID = `${msg.fromName}#${msg.fromId}`
    if (chatUserRef.current?.friendId === msg.fromId) { // 如果当前选中了好友就是聊天推送的数据,
      setChatRecordStatus("single",msg.cId)
    }
    setMessages((prev: any) => ({
      ...prev,
      [clientID]: [...prev[clientID], msg]
    }))
  }
  const changeChatUser = (item:any)=> {
    console.log(chatUser)
    setChatUser(item); 
    queryChatRecords(item);
    setChatRecordStatus("all", item.friendId)
  }

  const queryChatRecords = (chatUser: any) => { // 查询聊天记录
    sendMessage({
      type: "queryChatRecords", sendData: {
        friendId: chatUser.friendId
      }
    })
  }

  // type single/all
  const setChatRecordStatus = (type: string , cId: any) => {
    sendMessage({
      type: "changeChatRecordsStatus", sendData: {
        type,
        id: cId
      }
    })
  }

  return (
    <div className="flex h-full">
      <div className="w-64">
        <Card className="p-2 h-full border-0 rounded-none">
          <div className="flex gap-2 justify-end">
            <Popover>
              <PopoverTrigger asChild>
                <Button size="sm" variant="ghost" className="relative px-0">
                  <Bell />
                  {
                    notifyList.length > 0 && <p className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded"></p>
                  }
                </Button>
              </PopoverTrigger>
              <PopoverContent className="min-w-fit max-w-3xl">
                {
                  !notifyList || (Array.isArray(notifyList) && notifyList.length === 0) && <div className="text-center text-xs text-neutral-800">没有通知信息</div>
                }
                {
                  notifyList.map((item: any) => (
                    <div key={item.fId} className="flex items-center justify-between">
                      <div className="flex items-center text-xs text-neutral-800 pr-4">
                        <Bell size={15} />
                        <span className="ml-2">来自</span>
                        <Badge variant="secondary" className="mx-2">{item.fromName}</Badge>
                        <span>的好友请求。</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline" onClick={() => dealWithFriendsRequest("accept", item)}><CircleCheck color="#16a34a" /></Button>
                        <Button size="sm" variant="outline" onClick={() => dealWithFriendsRequest("reject", item)}><CircleX color="#ef4444" /></Button>
                      </div>
                    </div>
                  ))
                }
              </PopoverContent>
            </Popover>
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
                return <div className="p-4" key={item.friendId} onClick={() => { changeChatUser(item) }}>
                  {item.friendName}
                </div>
              })
            }
          </div>
        </Card>
      </div>
      {
        chatUser?.friendId && <Card className="h-full flex flex-col justify-between border-0 rounded-none border-l-[1px]" style={{ width: "calc(100% - 16rem)" }}>
          <CardHeader className="flex flex-row items-center h-14 p-2">
            <div className="flex items-center space-x-4">
              <Avatar>
                <AvatarFallback>{chatUser?.friendName.slice(0, 2)}</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-medium leading-none">{chatUser?.friendName}</p>
                <p className="text-sm text-muted-foreground">{chatUser?.friendRole}</p>
              </div>
            </div>

          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto p-4">
            <div className="space-y-4">
              {messages[`${chatUser.friendName}#${chatUser.friendId}`]?.map((message: any, index: number) => (
                <div
                  key={index}
                  className={cn(
                    "flex max-w-[75%] flex-col gap-2 rounded-lg px-3 py-2 text-sm w-fit break-words whitespace-pre-wrap",
                    message.fromId === userInfo.userId
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
      }

      {/* 添加好友弹框 */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="gap-0 p-0 outline-none">
          <DialogHeader className="px-4 pb-4 pt-5">
            <DialogTitle>查询用户</DialogTitle>
            <DialogDescription>您可以选择用户添加好友请求，同意后可以快捷聊天。</DialogDescription>
          </DialogHeader>
          <Command className="overflow-hidden rounded-t-none border-t bg-transparent">
            <CommandInput placeholder="搜索用户..." />
            <CommandList>
              <CommandEmpty>当前系统没有活跃用户。</CommandEmpty>
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
                        {
                          user.isActive && <Badge variant="secondary">在线</Badge>
                        }
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
                addFriends()
              }}
            >添加为好友</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}