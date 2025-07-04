package server

import (
	"LanDrop/client/db"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math/rand"
	"sync"
	"time"

	"github.com/gofiber/contrib/websocket"
	"github.com/gofiber/fiber/v2"
	"github.com/shirou/gopsutil/v4/cpu"
	"github.com/shirou/gopsutil/v4/mem"
	psNet "github.com/shirou/gopsutil/v4/net"
)

// WebSocket客户端结构体
type WSClient struct {
	clientID  string
	Id        string
	Name      string
	Conn      *websocket.Conn
	SLDB      db.SqlliteDB
	Send      chan []byte
	Hub       *WSHub
	UserToken string
	UserType  string
	IsActive  bool
	LastPing  time.Time
	mutex     sync.RWMutex
	ctx       context.Context
	cancel    context.CancelFunc
}
type WSMsg struct { // WebSocket通用消息结构体
	ReqID      string `json:"reqId"`      // 请求ID
	Type       string `json:"type"`       // 类型
	Content    any    `json:"content"`    // 内容
	ClientType string `json:"clientType"` // 客户端类型: LD_WEB / LD_APP
	TimeStamp  int64  `json:"timeStamp"`  // 消息时间戳
}

type WebMsg struct { // web客户端传来的消息结构体
	WSMsg
	User     UserInfo       `json:"user"`
	SendData map[string]any `json:"sendData"`
}

type UserInfo struct { // 用户信息
	UserId   int64  `json:"userId"`
	UserName string `json:"userName"`
}

// 设备实时信息结构体
type DeviceRealTimeInfo struct {
	Time     string                 `json:"time"`
	CPUUsage float64                `json:"cpuUsage"`
	MemUsage float64                `json:"memUsage"`
	Network  map[string]interface{} `json:"network,omitempty"`
}

// WebSocket Hub 管理所有连接
type WSHub struct {
	clients    map[string]*WSClient
	register   chan *WSClient
	unregister chan *WSClient
	broadcast  chan []byte
	mutex      sync.RWMutex
	ctx        context.Context
	cancel     context.CancelFunc
}

func init() {
	rand.Seed(time.Now().UnixNano())
}

// 创建新的WSHub
func NewWSHub(ctx context.Context) *WSHub {
	hubCtx, cancel := context.WithCancel(ctx)
	return &WSHub{
		clients:    make(map[string]*WSClient),
		register:   make(chan *WSClient),
		unregister: make(chan *WSClient),
		broadcast:  make(chan []byte, 1024*1024),
		ctx:        hubCtx,
		cancel:     cancel,
	}
}

// Hub运行主循环
func (h *WSHub) Run() {
	// 启动设备信息广播协程
	go h.startDeviceInfoBroadcast()
	// 启动连接健康检查
	go h.startHealthCheck()

	for {
		select {
		case <-h.ctx.Done():
			log.Println("WebSocket Hub正在关闭...")
			return

		case client := <-h.register:
			h.registerClient(client)

		case client := <-h.unregister:
			h.unregisterClient(client)

		case message := <-h.broadcast:
			h.broadcastMessage(message, "admin")
		}
	}
}

// 注册客户端
func (h *WSHub) registerClient(client *WSClient) {
	h.mutex.Lock()
	defer h.mutex.Unlock()

	h.clients[client.clientID] = client
	client.IsActive = true
	client.LastPing = time.Now()

	log.Printf("客户端 %s 已连接，当前连接数: %d", client.clientID, len(h.clients))

	// 发送欢迎消息
	welcomeMsg := WSMsg{
		Type:    "welcome",
		Content: "连接成功",
	}
	client.SendMessage(welcomeMsg)
}

// 注销客户端
func (h *WSHub) unregisterClient(client *WSClient) {
	h.mutex.Lock()
	defer h.mutex.Unlock()

	if _, exists := h.clients[client.clientID]; exists {
		// 1. 从Hub中移除
		delete(h.clients, client.clientID)

		// 2. 关闭发送通道
		close(client.Send)

		// 3. 取消上下文
		client.cancel()

		// 4. 关闭连接
		if client.Conn != nil {
			client.Conn.WriteMessage(websocket.CloseMessage, nil)
			client.Conn.Close()
		}

		log.Printf("客户端 %s 已完全断开，当前连接数: %d", client.clientID, len(h.clients))
	} else {
		log.Printf("注销客户端失败: 客户端 %s 不在连接列表中", client.clientID)
	}
}

// 广播消息给所有客户端
// 广播消息给所有客户端，可选的userTypeFilter参数用于过滤用户类型
func (h *WSHub) broadcastMessage(message []byte, userTypeFilter ...string) {
	h.mutex.RLock()
	clients := make([]*WSClient, 0, len(h.clients))
	for _, client := range h.clients {
		if client.IsActive {
			// 如果没有过滤条件，或者用户类型匹配
			if len(userTypeFilter) == 0 || client.UserType == userTypeFilter[0] {
				clients = append(clients, client)
			}
		}
	}
	h.mutex.RUnlock()

	for _, client := range clients {
		select {
		case client.Send <- message:
		default:
			// 客户端发送缓冲区满，强制断开连接
			h.unregister <- client
		}
	}
}

// 获取活跃连接数
func (h *WSHub) GetActiveConnections() int {
	h.mutex.RLock()
	defer h.mutex.RUnlock()
	return len(h.clients)
}

// 启动设备信息广播
func (h *WSHub) startDeviceInfoBroadcast() {
	ticker := time.NewTicker(3 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-h.ctx.Done():
			return

		case <-ticker.C:
			deviceInfo := h.getDeviceRealTimeInfo()
			message := WSMsg{
				Type:    "deviceRealTimeInfo",
				Content: deviceInfo,
			}

			if data, err := json.Marshal(message); err == nil {
				h.broadcast <- data
			} else {
				log.Printf("序列化设备信息失败: %v", err)
			}
		}
	}
}

// 启动连接健康检查
func (h *WSHub) startHealthCheck() {
	ticker := time.NewTicker(15 * time.Second) // 改为15秒
	defer ticker.Stop()

	for {
		select {
		case <-h.ctx.Done():
			return
		case <-ticker.C:
			h.mutex.RLock()
			clients := make([]*WSClient, 0, len(h.clients))
			for _, client := range h.clients {
				clients = append(clients, client)
			}
			h.mutex.RUnlock()

			for _, client := range clients {
				// 超时时间改为30秒
				if time.Since(client.LastPing) > 30*time.Second {
					log.Printf("客户端 %s 超时，将被断开", client.clientID)
					h.unregister <- client
					continue
				}

				// 发送ping消息
				pingMsg := WSMsg{
					Type:    "ping",
					Content: time.Now().Unix(),
				}
				client.SendMessage(pingMsg)
			}
		}
	}
}

// 获取设备实时信息
func (h *WSHub) getDeviceRealTimeInfo() DeviceRealTimeInfo {
	info := DeviceRealTimeInfo{
		Time:    time.Now().Format("2006-01-02 15:04:05"),
		Network: make(map[string]interface{}),
	}

	// CPU使用率
	if cpuUsage, err := cpu.Percent(time.Second, false); err == nil && len(cpuUsage) > 0 {
		info.CPUUsage = cpuUsage[0]
	}

	// 内存使用率
	if memInfo, err := mem.VirtualMemory(); err == nil {
		info.MemUsage = memInfo.UsedPercent
	}

	initialStats, _ := psNet.IOCounters(true)
	time.Sleep(1 * time.Second)
	currentStats, _ := psNet.IOCounters(true)
	// 计算增量
	for i, stat := range currentStats {
		if i < len(initialStats) {
			if stat.Name == initialStats[i].Name {
				upload := stat.BytesSent - initialStats[i].BytesSent
				download := stat.BytesRecv - initialStats[i].BytesRecv
				info.Network[stat.Name] = map[string]any{
					"adapterCode": stat.Name,
					"adapterName": stat.Name,
					"upload":      upload,
					"download":    download,
				}
			}
		}
	}

	return info
}

// 关闭Hub
func (h *WSHub) Close() {
	h.cancel()

	h.mutex.Lock()
	defer h.mutex.Unlock()

	for _, client := range h.clients {
		client.Conn.Close()
		client.cancel()
	}
}

// 客户端方法

// 创建新的WebSocket客户端
func NewWSClient(conn *websocket.Conn, hub *WSHub, db db.SqlliteDB, userType string, userToken string, id string, name string) *WSClient {
	ctx, cancel := context.WithCancel(context.Background())

	return &WSClient{
		clientID:  fmt.Sprintf(`%s#%s`, name, id),
		Id:        id,
		Name:      name,
		Conn:      conn,
		SLDB:      db,
		Send:      make(chan []byte, 1024*1024), // 支持10MB的聊天内容
		Hub:       hub,
		UserToken: userToken,
		UserType:  userType,
		IsActive:  false,
		LastPing:  time.Now(),
		ctx:       ctx,
		cancel:    cancel,
	}
}

// 客户端读取消息
// 客户端读取消息
func (c *WSClient) ReadPump() {
	defer func() {
		c.Hub.unregister <- c
		c.Conn.Close()
	}()
	log.Printf("客户端 %s 开始读取消息", c.clientID)

	// 设置读取限制和超时
	c.Conn.SetReadLimit(1024 * 1024 * 10) // 设置读15MB
	c.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	c.Conn.SetPongHandler(func(string) error {
		c.mutex.Lock()
		c.LastPing = time.Now()
		c.mutex.Unlock()
		c.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	for {
		select {
		case <-c.ctx.Done():
			log.Printf("客户端 %s 已关闭读取循环", c.clientID)
			return
		default:
			var msg WebMsg
			err := c.Conn.ReadJSON(&msg)
			if err != nil {
				log.Printf("WebSocket读取错误: %v，客户端 %s", err, c.clientID)
				return
			}
			log.Printf("收到来自客户端 %s 的消息: %+v", c.clientID, msg)
			c.handleMessage(msg)
		}
	}
}

// 客户端写入消息
// 客户端写入消息
func (c *WSClient) WritePump() {
	ticker := time.NewTicker(15 * time.Second) // 改为15秒
	defer func() {
		ticker.Stop()
		c.Hub.unregister <- c // 确保退出时注销
		c.Conn.Close()
	}()
	log.Printf("客户端 %s 开始写入消息", c.clientID)

	for {
		select {
		case <-c.ctx.Done():
			log.Printf("客户端 %s 已关闭写入循环", c.clientID)
			return

		case message, ok := <-c.Send:
			if !ok {
				// 通道已关闭
				log.Printf("客户端 %s 发送通道已关闭", c.clientID)
				return
			}

			c.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.safeWriteMessage(websocket.TextMessage, message); err != nil {
				log.Printf("客户端 %s 发送消息失败: %v", c.clientID, err)
				return
			}

		case <-ticker.C:
			c.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				log.Printf("客户端 %s 发送ping失败: %v", c.clientID, err)
				return
			}
		}
	}
}

// 安全的消息写入
func (c *WSClient) safeWriteMessage(messageType int, data []byte) error {
	c.mutex.Lock()
	defer c.mutex.Unlock()

	if !c.IsActive {
		return nil // 连接已关闭，忽略消息
	}

	return c.Conn.WriteMessage(messageType, data)
}

// 发送消息给客户端
func (c *WSClient) SendMessage(msg WSMsg) error {
	if !c.IsActive {
		return nil
	}

	data, err := json.Marshal(msg)
	if err != nil {
		return err
	}

	select {
	case c.Send <- data:
		return nil
	default:
		// 发送缓冲区满
		return fiber.NewError(fiber.StatusInternalServerError, "客户端发送缓冲区满")
	}
}

func generateClientID() string {
	return fmt.Sprintf("LD_%d_%d", time.Now().UnixMilli(), rand.Intn(100000))
}

// 处理客户端消息
func (c *WSClient) handleMessage(msg WebMsg) {
	c.mutex.Lock()
	c.LastPing = time.Now()
	c.mutex.Unlock()
	if msg.ReqID == "" {
		msg.ReqID = generateClientID()
	}
	switch msg.Type {
	case "pong":
		// 处理pong响应
		log.Printf("收到客户端 %s 的pong", c.clientID)
	case "pullData":
		pullData(c, msg)
	case "queryClients":
		queryClients(c, msg)
	case "addFriends":
		addFriends(c, msg)
	case "dealWithFriendsRequest":
		dealWithFriendsRequest(c, msg)
	case "chatSendData":
		chatSendData(c, msg)

	case "requestDeviceInfo":
		// 立即发送设备信息
		deviceInfo := c.Hub.getDeviceRealTimeInfo()
		response := WSMsg{
			Type:    "deviceRealTimeInfo",
			Content: deviceInfo,
		}
		c.SendMessage(response)

	default:
		log.Printf("未知消息类型: %s", msg.Type)
	}
}

// 发送错误消息并关闭连接
func sendErrorAndClose(conn *websocket.Conn, errorMsg string) {
	sendData := map[string]interface{}{
		"type":    "error",
		"content": errorMsg,
	}
	if sendByte, err := json.Marshal(sendData); err == nil {
		conn.SetWriteDeadline(time.Now().Add(5 * time.Second))
		conn.WriteMessage(websocket.TextMessage, sendByte)
	}
	conn.Close()
}

// 消息接收

func pullData(c *WSClient, msg WebMsg) {
	response := WSMsg{
		ReqID:      msg.ReqID,
		Type:       "initData",
		ClientType: "LD_APP",
		Content: map[string]any{
			"clientID":    c.clientID,
			"id":          c.Id,
			"name":        c.Name,
			"notifyList":  nil,
			"messageList": nil,
		},
		TimeStamp: time.Now().UnixMilli(),
	}
	if err := c.SendMessage(response); err != nil {
		log.Printf("reqID: %v|发送消息给客户端 %s 失败: %v", msg.ReqID, c.clientID, err)
	}
}
func queryClients(c *WSClient, msg WebMsg) {
	content := map[string]any{}
	if msg.User.UserId == 0 {
		content["code"] = -1
		content["error"] = "缺少用户信息,拒绝访问"
	} else {
		dataList := c.SLDB.QueryList(`SELECT * FROM users 
			WHERE id != ? AND id > 999
			AND NOT EXISTS (
				SELECT 1 FROM friendships 
				WHERE userId = ? AND friendId = users.id AND status != 'reject'
			)`, msg.User.UserId, msg.User.UserId)
		for _, item := range dataList {
			clientID := fmt.Sprintf(`%v#%v`, item["name"], item["id"])
			cItem, ok := c.Hub.clients[clientID]
			if ok {
				item["clientID"] = clientID
				item["isActive"] = cItem.IsActive
			} else {
				item["clientID"] = ""
				item["isActive"] = false
			}
		}
		content["code"] = 0
		content["error"] = nil
		content["data"] = dataList
	}
	response := WSMsg{
		ReqID:      msg.ReqID,
		Type:       "clientList",
		ClientType: "LD_APP",
		Content:    content,
		TimeStamp:  time.Now().UnixMilli(),
	}
	if err := c.SendMessage(response); err != nil {
		log.Printf("reqID: %v|发送消息给客户端 %s 失败: %v", msg.ReqID, c.clientID, err)
	}
}

func addFriends(c *WSClient, m WebMsg) {
	to := m.SendData["to"].(string)
	result, _ := c.SLDB.Exec(`INSERT INTO friendships ("userId", "friendId", "status", "createTime") VALUES (?, ?, 'pending', ?)`,
		m.SendData["fromId"], m.SendData["toId"], time.Now().UnixMilli())
	fId, _ := result.LastInsertId()
	m.SendData["fId"] = fId // 注入fId
	receiveData := WSMsg{
		Type:    "checkAddFriends",
		Content: m.SendData,
	}
	// 针对特定客户端发送消息
	if targetClient, ok := c.Hub.clients[to]; ok {
		if err := targetClient.SendMessage(receiveData); err != nil {
			log.Printf("reqID: %v|发送消息给客户端 %s 失败: %v", m.ReqID, c.clientID, err)
		}
	} else {
		log.Println("目标客户端未在线", to, m.ReqID)
	}
}

func dealWithFriendsRequest(c *WSClient, m WebMsg) {
	status, ok := m.SendData["status"].(string)
	if ok && m.SendData["fId"] != nil {
		dataList := c.SLDB.QueryList(`SELECT * FROM friendships WHERE fId = ?`, m.SendData["fId"])
		if len(dataList) == 1 {
			if status == "accept" {
				c.SLDB.Exec(`INSERT INTO friendships ("userId", "friendId", "status", "createTime") VALUES (?, ?, ?, ?)`,
					dataList[0]["friendId"], dataList[0]["userId"], status, time.Now().UnixMilli())
			}
			c.SLDB.Exec(`UPDATE friendships SET status = ? WHERE fId = ?`, status, m.SendData["fId"])
		}

	}
}

func chatSendData(c *WSClient, m WebMsg) {
	to := m.SendData["to"].(string)
	receiveData := WSMsg{
		Type:    "chatReceiveData",
		Content: m.Content,
	}
	list := c.SLDB.QueryList(`SELECT * FROM friendships WHERE userId = ? AND friendId = ?`, m.SendData["fromId"], m.SendData["toId"])
	if len(list) == 0 {
		info := fmt.Sprintf("不存在的好友关系不能发送消息:%v=>%v", m.SendData["fromId"], m.SendData["toId"])
		commonError := WSMsg{
			Type: "commonError",
			Content: map[string]any{
				"error": info,
			},
		}
		if err := c.SendMessage(commonError); err != nil {
			log.Printf("reqID: %v|发送消息给客户端 %s 失败: %v", m.ReqID, c.clientID, err)
		}
		return
	}
	c.SLDB.Exec(`INSERT INTO chat_records ("to", "from", "message", "isRead", "time") VALUES ('?, ?, ?, ?, ?)`, m.SendData["to"], m.SendData["from"], m.SendData["message"], "n", time.Now().Unix())
	// 针对特定客户端发送消息
	if targetClient, ok := c.Hub.clients[to]; ok {
		if err := targetClient.SendMessage(receiveData); err != nil {
			log.Printf("reqID: %v|发送消息给客户端 %s 失败: %v", m.ReqID, c.clientID, err)
		}
	} else {
		log.Println("目标客户端未在线", to, m.ReqID)
	}
}
