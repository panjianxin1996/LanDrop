import useClientStore from "@/store/appStore"
import React from "react"
type WebMsg = {
    sId?: string,
    type: string,
    content?: any,
    user?: any,
    sendData?: any,
}
export function useWebSocket() {
    const { userInfo, wsHandle } = useClientStore()
    const sendMessage = React.useCallback((webMsg: WebMsg) => {
        console.log("发送消息", wsHandle?.readyState, webMsg)
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
    }, [userInfo, wsHandle])
    return {
        sendMessage
    }
}

export type {
    WebMsg
}
