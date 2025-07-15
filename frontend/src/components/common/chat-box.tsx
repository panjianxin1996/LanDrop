import * as React from "react"
import { Check, Send, Bell, UserRoundPlus, CircleCheck, CircleX, UserRound, ChevronLeft } from "lucide-react"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, } from "@/components/ui/command"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger, } from "@/components/ui/tooltip"
import { Popover, PopoverContent, PopoverTrigger, } from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import useClientStore from "@/store/appStore"
import dayjs from "dayjs"

// 发送ws服务器数据结构
type WebMsg = {
  sId?: string,
  type: string,
  content?: any,
  user?: any,
  sendData?: any,
}

// 客户端数据
type ClientData = {
  clientID: string,
  id: string,
  name: string,
  notifyList: Array<NotifyItem>,
  messageList: any
}

// 通知
type NotifyItem = {
  createTime: string
  fId: number
  friendId: number
  fromId: number
  fromIp: string
  fromName: string
  fromNickName: string
  fromRole: string
  lastChatId: string | null
  status: string
  toId: number
  toIp: string
  toName: string
  toRole: string
  userId: number
}

// 聊天好友
type ChatUserItem = {
  createTime: string
  fId: number
  friendId: number
  friendIp: string
  friendName: string
  friendNickName: string
  friendAvatar: string
  friendRole: string
  lastChatId: string | null
  lastMsg: string | null
  msgType: string | null
  msgTime: string | null
  status: string
  userId: number
  unreadCount: number
}
// 用户信息
type UserItem = {
  clientID: string
  createdAt: string
  id: number
  ip: string
  isActive: boolean
  avatar: string
  name: string
  nickName: string
  pwd: string
  role: string
}
// 消息
type Message = {
  cId: number | null
  fromId: number
  fromName: string
  isRead: string | null
  message: string
  time: number | null
  toId: number | null
  toName: string | null
  type: string | null
}

export default function ChatBox({ userId }: { userId: number }) {
  const { wsHandle, userInfo, socketQueue, setStoreData } = useClientStore()
  const [clientData, setClientData] = React.useState<ClientData>({ // 当前设备数据，包含了设备信息以及离线情况设备消息、通知
    clientID: "",
    id: "",
    name: "",
    notifyList: [],
    messageList: null,
  })
  const [open, setOpen] = React.useState(false)
  const [selectedUsers, setSelectedUsers] = React.useState<Array<UserItem>>([])
  const [chatUser, setChatUser] = React.useState<ChatUserItem | null>(null) // 聊天中的好友
  const [chatUserList, setChatUserList] = React.useState<Array<ChatUserItem>>([]) //左侧好友列表
  const [messages, setMessages] = React.useState<Record<string, Array<Message>>>({})
  const [input, setInput] = React.useState("")
  const [users, setUsers] = React.useState<Array<UserItem>>([])
  const [notifyList, setNotifyList] = React.useState<Array<NotifyItem>>([])
  const chatUserRef = React.useRef(chatUser) // 为了方便onMessage中获取最新的chatUser
  const chatWindowRef = React.useRef<any>(null)
  const inputLength = input.trim().length
  React.useEffect(() => {
    console.log("当前聊天用户ID:", userId)
    if (userId && userId > 0 && wsHandle) {
      initData()
      sendMessage({ type: "pullData" }) // 获取初始数据
      queryFriendList()
    }
  }, [userId])
  React.useEffect(() => {
    chatUserRef.current = chatUser;
  }, [chatUser]);
  React.useEffect(() => { // 监听chatUser切换
    if (socketQueue.length > 0) {
      socketQueue.forEach(socket => {
        if (socket.type && OnMessageOperation[socket.type]) {
          OnMessageOperation[socket.type](socket.content)
        }
      })
      setStoreData({
        before: (_, set) => {
          set({ socketQueue: [] })
        }
      })
    }
  }, [socketQueue]) // socket队列数据更新
  React.useEffect(() => {
    if (chatUser && chatWindowRef.current) {
      chatWindowRef.current.scrollTo({
        top: chatWindowRef.current.scrollHeight,
        behavior: 'smooth' // 平滑滚动
      });
    }
  }, [messages])

  const OnMessageOperation: Record<string, Function> = {
    // 处理通用错误数据
    "commonError": (content: any) => {
      console.warn("监听到ws处理错误:", content.error)
      if (content.code === 401) {
        setStoreData({
          set: {
            validExpToken: true,

          }
        })
      }
    },
    // 获取整体数据包含当前客户端信息以及离线数据通知、消息
    "replyPullData": (content: any) => {
      let rData = content.data
      setClientData(rData)
      if (rData.notifyList && Array.isArray(rData.notifyList)) {
        setNotifyList(rData.notifyList)
      }
    },
    // 接收聊天数据（需要为好友关系）[@送达方会接收回调]
    "replyChatReceiveData": (content: any) => {
      if (content.code === 1 && !!content.data) {
        let msg = content.data[0]
        let clientID = `${msg.fromName}#${msg.fromId}`
        if (chatUserRef.current?.friendId === msg.fromId) { // 如果当前选中了好友就是聊天推送的数据,
          setChatRecordStatus("single", +msg.cId)
        }
        setMessages((prev: Record<string, Array<Message>>) => {
          if (clientID && prev[clientID]) {
            return {
              ...prev,
              [clientID]: [...prev[clientID], msg]
            }
          } else {
            return prev
          }

        })
      }
    },
    // 客户端列表，用于添加好友
    "replyClientList": (content: any) => {
      setUsers(content.data || [])
    },
    // 添加好友回调，[@送达方会接收回调]
    "replyAddFriends": (content: any) => {
      if (content.code === 1) setNotifyList([...notifyList, ...content.data])
    },
    // 处理好友请求回调
    "replyDealWithFriends": (content: any) => {
      if (content.code === 1 && content.data) {
        setNotifyList(prevList => {
          const filtered = prevList.filter(item => item.fId !== content.data);
          return filtered;
        });
        queryFriendList()
      }
    },
    // 好友列表数据
    "replyFriendList": (content: any) => {
      if (content.code === 1 && content.data) {
        setChatUserList(content.data)
        // 初始化用户的聊天记录数据
        let messageList: Record<string, Array<Message>> = {}
        content.data.forEach((item: ChatUserItem) => (messageList[`${item.friendName}#${item.friendId}`] = []))
        setMessages(messageList)
      }
    },
    // 聊天记录数据 需要传递好友clientID
    "replyChatRecords": (content: any) => {
      if (content.code === 1 && content.data) {
        const chatUser = chatUserRef.current;
        let clientID = `${chatUser?.friendName}#${chatUser?.friendId}`
        setMessages((prev: Record<string, Array<Message>>) => ({
          ...prev,
          [clientID]: content.data
        }))
      }
    },
    // 更新最新的好友列表
    "replyLatestFriendList": (content: any) => {
      if (content.code === 1 && content.data) {
        setChatUserList(content.data)
      }
    }
  }

  const sendMessage = (webMsg: WebMsg) => { // 封装socket发送
    if (!userInfo.userId || !userInfo.userName) {
      console.warn("发送消息失败，未获取到用户信息。。。")
      return
    }
    if (!wsHandle || wsHandle.readyState != wsHandle.OPEN) {
      console.warn("发送消息失败，socket连接断开。。。", wsHandle?.readyState)
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
  const initData = () => { // 初始化数据
    setClientData({
      clientID: "",
      id: "",
      name: "",
      notifyList: [],
      messageList: null,
    })
    setSelectedUsers([])
    setChatUser(null)
    setChatUserList([])
    setMessages({})
    setNotifyList([])
  }
  const chatSendData = (message: string) => { // 发送聊天信息
    let clientID = `${chatUser?.friendName}#${chatUser?.friendId}`
    let newMsg: Message = {
      cId: null,
      fromName: userInfo.userName,
      isRead: null,
      time: null,
      toId: chatUser && chatUser.friendId,
      toName: chatUser && chatUser.friendName,
      type: null,
      fromId: +userInfo.userId, message
    }
    // 用户下的messages追加数据
    setMessages((prev: Record<string, Array<Message>>) => ({
      ...prev,
      [clientID]: [...prev[clientID], newMsg]
    }))
    sendMessage({
      type: "chatSendData",
      sendData: {
        to: clientID,
        toId: chatUser?.friendId,
        from: userInfo.userName,
        fromId: userInfo.userId,
        message
      }
    })
  };
  const getClientList = () => { // 查询客户端列表
    sendMessage({ type: "queryClients" })
  }

  const dealWithFriendsRequest = (status: string, nItem: NotifyItem) => { // 处理好友请求
    sendMessage({
      type: "dealWithFriendsRequest", sendData: {
        ...nItem,
        status,
      }
    })
  }

  const addFriends = () => { // 添加好友
    let friend = selectedUsers && selectedUsers[0] // 只能当选默认第一条
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

  const changeChatUser = (chatUser: ChatUserItem) => { // 切换好友
    setChatUser(chatUser);
    queryChatRecords(chatUser);
    setChatRecordStatus("all", chatUser.friendId)
  }

  const queryChatRecords = (chatUser: ChatUserItem) => { // 查询聊天记录
    sendMessage({
      type: "queryChatRecords", sendData: {
        friendId: chatUser.friendId
      }
    })
  }

  const setChatRecordStatus = (type: string, cId: number) => { // type single/all 改变聊天记录的状态
    sendMessage({
      type: "changeChatRecordsStatus", sendData: {
        type,
        id: cId
      }
    })
  }

  const selectAddUser = (user: UserItem) => {
    {
      if (selectedUsers.includes(user)) {
        return setSelectedUsers(
          selectedUsers.filter(
            (selectedUser: UserItem) => selectedUser !== user
          )
        )
      }
      return setSelectedUsers(
        [...users].filter((u) =>
          [...selectedUsers, user].includes(u)
        )
      )
    }
  }

  return (
    <div className="flex h-full relative">
      <div className="w-full sm:w-64">
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
                  notifyList.map((item: NotifyItem) => (
                    <div key={item.fId} className="flex items-center justify-between">
                      <div className="flex items-center text-xs text-neutral-800 pr-4">
                        <Bell size={15} />
                        <span className="ml-2">来自</span>
                        <Badge variant="secondary" className="mx-2">{item.fromNickName}</Badge>
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
              chatUserList.map((item: ChatUserItem) => {
                return <div className={`relative h-12 flex items-center mb-2 cursor-pointer p-[4px] hover:bg-slate-100 ${chatUser?.friendId === item.friendId ? 'bg-slate-200' : ''}`} key={item.friendId} onClick={() => { changeChatUser(item) }}>
                  <div className="relative">
                    <Avatar>
                      <AvatarFallback className="text-xl">
                        {item.friendAvatar || <UserRound />}
                      </AvatarFallback>

                    </Avatar>
                    {
                      item.unreadCount > 0 && <p className="text-xs absolute top-[-5px] right-[-5px] bg-red-500 rounded px-[3px] text-white">{item.unreadCount}</p>
                    }
                  </div>
                  <div className="w-3/5 flex flex-col justify-between pl-4">
                    <p className="text-sm font-medium leading-none whitespace-nowrap overflow-visible truncate">{item.friendNickName}</p>
                    <p className="text-xs text-muted-foreground whitespace-nowrap overflow-visible truncate mt-2">{item.lastMsg}</p>
                  </div>
                  <div className="w-[calc(40%-2.5rem)] flex flex-col justify-start h-full text-xs text-gray-400 pl-4 text-right">
                    <div>{item.msgTime ? dayjs(item.msgTime).format("HH:MM") : ''}</div>
                  </div>
                </div>
              })
            }
          </div>
        </Card>
      </div>
      {/* 好友聊天窗口面板 */}
      {
        chatUser?.friendId && <Card className="absolute w-full sm:w-[calc(100%-16rem)] pt-12 sm:pt-0 sm:relative h-full flex flex-col justify-between border-0 rounded-none border-l-[1px]">
          <CardHeader className="flex flex-row items-center h-10 p-2 text-lg font-medium leading-none border-b-[1px]">
            <Button size={"sm"} onClick={() => setChatUser(null)} variant={"ghost"} className="p-0 pr-4">
              <ChevronLeft />
            </Button>
            {chatUser?.friendNickName}
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto p-4" ref={chatWindowRef}>
            <div className="space-y-4">
              {messages[`${chatUser.friendName}#${chatUser.friendId}`]?.map((message: Message, index: number) => (
                <div
                  key={index}
                  className={cn(
                    "flex max-w-[75%] flex-col gap-2 rounded-lg px-3 py-2 text-sm w-fit break-words whitespace-pre-wrap",
                    message.fromId === +userInfo.userId
                      ? "ml-auto bg-primary text-primary-foreground"
                      : "bg-muted"
                  )}
                >{message.message}</div>
              ))}
            </div>
          </CardContent>
          <CardFooter className="p-2 pt-0 pb-4">
            <form
              onSubmit={(event) => {
                event.preventDefault()
                if (inputLength === 0) return
                chatSendData(input)
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
                {users.map((user: UserItem) => (
                  <CommandItem
                    key={user.id}
                    className="flex items-center px-2"
                    onSelect={() => selectAddUser(user)}
                  >
                    <Avatar>
                      <AvatarFallback className="text-xl">
                        {user.avatar || <UserRound />}
                      </AvatarFallback>
                    </Avatar>
                    <div className="ml-2">
                      <p className="text-sm font-medium leading-none">
                        {user.nickName}
                      </p>
                      <div className="text-sm text-muted-foreground">
                        {user.role === 'admin' ? "管理员" : "普通用户"}
                        {
                          user.isActive && <Badge variant="secondary">在线</Badge>
                        }
                      </div>
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
                {selectedUsers.map((user: UserItem) => (
                  <Avatar
                    key={user.id}
                    className="inline-block border-2 border-background"
                  >
                    <AvatarFallback>
                      {user.avatar || <UserRound />}
                    </AvatarFallback>
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