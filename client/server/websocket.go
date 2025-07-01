package server

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
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

// WebSocket消息结构体
type WSMessage struct {
	Type    string      `json:"type"`
	Content interface{} `json:"content"`
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

// 创建新的WSHub
func NewWSHub(ctx context.Context) *WSHub {
	hubCtx, cancel := context.WithCancel(ctx)
	return &WSHub{
		clients:    make(map[string]*WSClient),
		register:   make(chan *WSClient),
		unregister: make(chan *WSClient),
		broadcast:  make(chan []byte, 256),
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
	welcomeMsg := WSMessage{
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
		delete(h.clients, client.clientID)
		close(client.Send)
		client.IsActive = false
		client.cancel()

		log.Printf("客户端 %s 已断开连接，当前连接数: %d", client.clientID, len(h.clients))
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
			message := WSMessage{
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
	ticker := time.NewTicker(30 * time.Second)
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
				// 检查客户端是否超时
				if time.Since(client.LastPing) > 60*time.Second {
					log.Printf("客户端 %s 超时，将被断开", client.clientID)
					h.unregister <- client
					continue
				}

				// 发送ping消息
				pingMsg := WSMessage{
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
func NewWSClient(conn *websocket.Conn, hub *WSHub, userType string, userToken string, id string, name string) *WSClient {
	ctx, cancel := context.WithCancel(context.Background())

	return &WSClient{
		clientID:  fmt.Sprintf(`%s#%s`, name, id),
		Id:        id,
		Name:      name,
		Conn:      conn,
		Send:      make(chan []byte, 256),
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
func (c *WSClient) ReadPump() {
	defer func() {
		c.Hub.unregister <- c
		c.Conn.Close()
	}()
	// 设置读取限制和超时
	c.Conn.SetReadLimit(512)
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
			return
		default:
			var msg WSMessage
			err := c.Conn.ReadJSON(&msg)
			if err != nil {
				if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
					log.Printf("WebSocket读取错误: %v", err)
				}
				return
			}
			c.handleMessage(msg)
		}
	}
}

// 客户端写入消息
func (c *WSClient) WritePump() {
	ticker := time.NewTicker(54 * time.Second)
	defer func() {
		ticker.Stop()
		c.Conn.Close()
	}()

	for {
		select {
		case <-c.ctx.Done():
			return

		case message, ok := <-c.Send:
			c.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			if err := c.safeWriteMessage(websocket.TextMessage, message); err != nil {
				log.Printf("发送消息失败: %v", err)
				return
			}

			// 批量发送队列中的其他消息
			n := len(c.Send)
			for i := 0; i < n; i++ {
				if err := c.safeWriteMessage(websocket.TextMessage, <-c.Send); err != nil {
					log.Printf("批量发送消息失败: %v", err)
					return
				}
			}

		case <-ticker.C:
			c.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				log.Printf("发送ping失败: %v", err)
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
func (c *WSClient) SendMessage(msg WSMessage) error {
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

// 处理客户端消息
func (c *WSClient) handleMessage(msg WSMessage) {
	c.mutex.Lock()
	c.LastPing = time.Now()
	c.mutex.Unlock()
	log.Println("onMessage", msg.Type)
	switch msg.Type {
	case "pong":
		// 处理pong响应
		log.Printf("收到客户端 %s 的pong", c.clientID)
	case "getClientList":
		clientsList := []map[string]any{}
		for _, v := range c.Hub.clients {
			client := map[string]any{}
			client["name"] = v.Name
			client["id"] = v.clientID
			client["type"] = v.UserType
			client["isActive"] = v.IsActive
			clientsList = append(clientsList, client)
		}
		response := WSMessage{
			Type:    "clientList",
			Content: clientsList,
		}
		if err := c.SendMessage(response); err != nil {
			log.Printf("发送消息给客户端 %s 失败: %v", c.clientID, err)
		}
	case "chatSendData":
		if content, ok := msg.Content.(map[string]any); ok {
			// from := content["from"]
			to := content["to"].(string)
			// message := content["message"]
			// todo 记录数据库
			receiveData := WSMessage{
				Type:    "chatReceiveData",
				Content: msg.Content,
			}
			// 针对特定客户端发送消息
			log.Printf("发送消息给客户端 %s", to)
			c.Hub.clients[to].SendMessage(receiveData)
		}
		log.Println(msg.Content)
	case "requestDeviceInfo":
		// 立即发送设备信息
		deviceInfo := c.Hub.getDeviceRealTimeInfo()
		response := WSMessage{
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
