package server

import (
	"context"
	"database/sql"
	"embed"
	"log"
	"net/http"
	"path/filepath"
	"strings"
	"time"

	"github.com/gofiber/contrib/websocket"
	"github.com/gofiber/fiber/v2"
	"github.com/shirou/gopsutil/v4/cpu"
	"github.com/shirou/gopsutil/v4/mem"
	psNet "github.com/shirou/gopsutil/v4/net"
)

type Router struct {
	app    *fiber.App
	assets embed.FS
	config Config
	Reply
	db *sql.DB
}
type FileInfo struct {
	ID       int    `json:"fileId"`
	Name     string `json:"fileName"`
	Size     int    `json:"fileSize"`
	Mode     string `json:"fileMode"`
	ModTime  string `json:"fileModTime"`
	IsDir    bool   `json:"isDir"`
	URIName  string `json:"uriName"`
	Path     string `json:"path"`
	FileCode string `json:"fileCode"`
}

type Reply struct {
	Code int    `json:"code"`
	Msg  string `json:"msg"`
	Data any    `json:"data"`
}

// 全局WebSocket Hub实例
var wsHub *WSHub

func startRouter(app *fiber.App, assets embed.FS, config Config, db *sql.DB) {
	ctx := context.Background()
	wsHub = NewWSHub(ctx)
	go wsHub.Run()
	r := Router{
		app:    app,
		assets: assets,
		config: config,
		db:     db,
	}
	// WebSocket 升级中间件
	app.Use("/ws", func(c *fiber.Ctx) error {
		if websocket.IsWebSocketUpgrade(c) {
			c.Locals("allowed", true)
			return c.Next()
		}
		return fiber.ErrUpgradeRequired
	})

	// WebSocket 路由
	app.Get("/ws", websocket.New(func(conn *websocket.Conn) {
		// 验证token
		token := conn.Query("ldToken")
		id := conn.Query("id")
		name := conn.Query("name")
		if token == "" || id == "" || name == "" {
			sendErrorAndClose(conn, "缺少token数据")
			return
		}

		tokenJWT, err := ParseToken(token)
		if err != nil {
			sendErrorAndClose(conn, "无法验证token有效性")
			return
		}

		// 验证角色权限 - 修复逻辑判断
		if tokenJWT.Role != "admin" && tokenJWT.Role != "guest" {
			sendErrorAndClose(conn, "token角色验证失败")
			return
		}

		// 创建客户端
		wsClient := NewWSClient(conn, wsHub, tokenJWT.Role, token, id, name)

		// 注册客户端
		wsHub.register <- wsClient

		// 启动读写协程
		go wsClient.WritePump()
		wsClient.ReadPump() // 阻塞在这里，直到连接关闭
	}))
	// \server\router.go
	api := r.app.Group("/api/v1")
	{
		// 获取设备信息
		api.Get("/getDeviceInfo", r.getDeviceInfo)
		// 上传文件到shared目录
		api.Post("/uploadFile", r.uploadFile)
		// 获取共享目录信息
		api.Get("/getSharedDirInfo", r.getSharedDirInfo)
		// 通过fileId 获取真实路径
		api.Get("/getRealFilePath", r.getRealFilePath)
		// 获取所有网卡信息包括ipv4 v6地址
		api.Get("/getNetworkInfo", r.getNetworkInfo)
		// 动态设置本机ip地址信息
		api.Post("/setIpAddress", r.setIpAddress)
		// 获取用户信息
		api.Post("/getUserList", r.getUserList)
		// 创建用户
		api.Post("/createUser", r.createUser)
		// 创建用户token
		api.Post("/createToken", r.createToken)
		// 解绑用户
		api.Post("/unBindUser", r.unBindUser)
		// 客户端登录
		api.Post("/appLogin", r.appLogin)
		// websocket状态
		api.Get("/getWSStatus", r.getWSStatus)
	}
}

// --- 控制器函数 ---

// 获取设备信息
func (r Router) getDeviceInfo(c *fiber.Ctx) error {
	// CPU 使用率
	// percent, _ := cpu.Percent(time.Second, false)
	cpuInfos, _ := cpu.Info()
	// 内存信息
	memInfo, _ := mem.VirtualMemory()
	r.Reply = Reply{
		Code: http.StatusOK,
		Msg:  "OK",
		Data: map[string]any{
			"cpuInfo":     cpuInfos[0],
			"cpuInfoList": cpuInfos,
			"memInfo":     memInfo,
		},
	}
	return c.Status(http.StatusOK).JSON(r.Reply)
}

func (r Router) uploadFile(c *fiber.Ctx) error {
	file, err := c.FormFile("file")
	if err != nil {
		r.Reply = Reply{
			Code: http.StatusBadRequest,
			Msg:  "failed",
			Data: nil,
		}
		return c.Status(r.Reply.Code).JSON(r.Reply)
	}
	if err := c.SaveFile(file, filepath.Join(r.config.SharedDir, file.Filename)); err != nil {
		log.Println("Save Error:", err)
		r.Reply = Reply{
			Code: http.StatusInternalServerError,
			Msg:  "Failed saved file.",
			Data: nil,
		}
		return c.Status(r.Reply.Code).JSON(r.Reply)
	}
	r.Reply = Reply{
		Code: http.StatusOK,
		Msg:  "successed",
		Data: map[string]any{
			"fileName": file.Filename,
		},
	}
	return c.Status(r.Reply.Code).JSON(r.Reply)
}

func (r Router) getSharedDirInfo(c *fiber.Ctx) error {
	rows, err := r.db.Query("SELECT * FROM files")
	if err != nil {
		r.Reply = Reply{
			Code: http.StatusBadRequest,
			Msg:  "query failed",
			Data: nil,
		}
		return c.Status(r.Reply.Code).JSON(r.Reply)
	}
	defer rows.Close()

	var files []FileInfo // 假设有一个File结构体对应表结构
	for rows.Next() {
		var f FileInfo
		scanErr := rows.Scan(&f.ID, &f.Name, &f.Size, &f.Mode, &f.ModTime, &f.IsDir, &f.URIName, &f.Path, &f.FileCode)
		if scanErr != nil {
			log.Printf("扫描行失败: %v", scanErr)
			continue
		}
		files = append(files, f)
	}

	if err = rows.Err(); err != nil {
		r.Reply = Reply{
			Code: http.StatusBadRequest,
			Msg:  "scan failed",
			Data: nil,
		}
		return c.Status(r.Reply.Code).JSON(r.Reply)
	}
	r.Reply = Reply{
		Code: http.StatusOK,
		Msg:  "successed",
		Data: map[string]any{
			"sharedDir": r.config.SharedDir,
			"files":     files,
		},
	}
	return c.Status(r.Reply.Code).JSON(r.Reply)
}

func (r Router) getRealFilePath(c *fiber.Ctx) error {
	fileCode := c.Query("fileCode")
	var f FileInfo
	row := r.db.QueryRow("SELECT * FROM files WHERE fileCode = ?", fileCode)
	row.Scan(&f.ID, &f.Name, &f.Size, &f.Mode, &f.ModTime, &f.IsDir, &f.URIName, &f.Path, &f.FileCode)
	if row.Err() != nil {
		r.Reply.Code = 199
		r.Reply.Msg = "query failed."
	} else {
		r.Reply.Code = http.StatusOK
		r.Reply.Data = f
		r.Reply.Msg = "successed"
	}
	return c.Status(http.StatusOK).JSON(r.Reply)
}

func (r Router) getNetworkInfo(c *fiber.Ctx) error {
	// 获取所有网络接口的IP地址
	addrs, err := psNet.Interfaces()
	if err != nil {
		r.Reply.Code = http.StatusBadRequest
		r.Reply.Msg = "get network info failed."
	} else {
		interfaces := []map[string]any{}
		for _, addr := range addrs {
			interfaceItem := map[string]any{}
			ips := []string{}
			for _, a := range addr.Addrs {
				ips = append(ips, a.Addr)
			}
			interfaceItem["name"] = addr.Name
			interfaceItem["ips"] = ips
			interfaces = append(interfaces, interfaceItem)
		}
		r.Reply.Code = http.StatusOK
		r.Reply.Msg = "success."
		r.Reply.Data = interfaces
	}
	return c.Status(r.Reply.Code).JSON(r.Reply)
}

func (r Router) setIpAddress(c *fiber.Ctx) error {
	postBody := map[string]string{}
	if err := c.BodyParser(&postBody); err != nil {
		r.Reply.Code = http.StatusBadRequest
		r.Reply.Msg = "parse body failed."
		r.Reply.Data = err
	} else {
		SetAppIPv4(postBody["ipv4"])
		SetAppIPv6(postBody["ipv6"])
		r.Reply.Code = http.StatusOK
		r.Reply.Msg = "set ip success."
	}
	return c.Status(r.Reply.Code).JSON(r.Reply)
}

func (r Router) getUserList(c *fiber.Ctx) error {
	postBody := map[string]string{}
	clientIP := c.IP()
	if forwardedFor := c.Get("X-Forwarded-For"); forwardedFor != "" {
		// 如果有代理，取第一个IP（最原始客户端IP）
		ips := strings.Split(forwardedFor, ",")
		clientIP = strings.TrimSpace(ips[0])
	}
	if err := c.BodyParser(&postBody); err != nil {
		r.Reply.Code = http.StatusBadRequest
		r.Reply.Msg = "请验证参数正确性"
		r.Reply.Data = err
		return c.Status(r.Reply.Code).JSON(r.Reply)
	}
	rows, err := r.db.Query(`SELECT * FROM "users" WHERE ip = ? AND role= 'guest'`, clientIP)
	if err != nil {
		r.Reply.Code = http.StatusInternalServerError
		r.Reply.Msg = "服务器错误"
		r.Reply.Data = err
		return c.Status(r.Reply.Code).JSON(r.Reply)
	}
	columns, _ := rows.Columns()
	values := make([]any, len(columns))
	for i := range values {
		var v any
		values[i] = &v
	}
	var userList []map[string]any
	for rows.Next() {
		if err := rows.Scan(values...); err != nil {
			log.Printf("扫描行失败: %v", err)
			continue
		}
		row := make(map[string]any)
		for i, col := range columns {
			row[col] = *(values[i].(*any))
		}
		userList = append(userList, row)
	}
	r.Reply.Code = http.StatusOK
	r.Reply.Msg = "查询成功"
	r.Reply.Data = userList
	return c.Status(r.Reply.Code).JSON(r.Reply)
}

func (r Router) createUser(c *fiber.Ctx) error {
	postBody := map[string]string{}
	clientIP := c.IP()
	if forwardedFor := c.Get("X-Forwarded-For"); forwardedFor != "" {
		// 如果有代理，取第一个IP（最原始客户端IP）
		ips := strings.Split(forwardedFor, ",")
		clientIP = strings.TrimSpace(ips[0])
	}
	if err := c.BodyParser(&postBody); err != nil {
		r.Reply.Code = http.StatusBadRequest
		r.Reply.Msg = "请验证参数正确性"
		r.Reply.Data = err
		return c.Status(r.Reply.Code).JSON(r.Reply)
	}
	if postBody["userName"] == "" {
		r.Reply.Code = http.StatusOK
		r.Reply.Msg = "缺少关键参数"
		r.Reply.Data = nil
		return c.Status(r.Reply.Code).JSON(r.Reply)
	}
	row := r.db.QueryRow(`SELECT COUNT(ip) as countIP FROM "users" WHERE ip = ? AND role = 'guest'`, clientIP)
	countIP := 0
	row.Scan(&countIP)
	if countIP >= 5 {
		r.Reply.Code = -1
		r.Reply.Msg = "当前ip地址已经注册超过五台设备，请先解绑后进行注册。"
		r.Reply.Data = nil
		return c.Status(http.StatusOK).JSON(r.Reply)
	}
	result, err := r.db.Exec(`INSERT INTO users (name, pwd, role, ip, createdAt) VALUES (?, ?, ?, ?, ?);`, postBody["userName"], postBody["userName"]+"#123", "guest", clientIP, time.Now().Format("2006-01-02 15:04:05"))
	if err != nil {
		r.Reply.Code = http.StatusBadRequest
		r.Reply.Msg = "创建失败"
		r.Reply.Data = nil
		return c.Status(r.Reply.Code).JSON(r.Reply)
	}
	insertId, _ := result.LastInsertId()
	r.Reply.Code = http.StatusOK
	r.Reply.Msg = "完成"
	r.Reply.Data = map[string]any{
		"createId": insertId,
	}
	return c.Status(r.Reply.Code).JSON(r.Reply)
}

func (r Router) createToken(c *fiber.Ctx) error {
	postBody := struct {
		UserId   int64  `json:"userId"`
		UserName string `json:"userName"`
	}{}
	if err := c.BodyParser(&postBody); err != nil {
		r.Reply.Code = http.StatusBadRequest
		r.Reply.Msg = "请验证参数正确性"
		r.Reply.Data = err
		return c.Status(r.Reply.Code).JSON(r.Reply)
	}

	if postBody.UserId == 0 || postBody.UserName == "" {
		r.Reply.Code = http.StatusOK
		r.Reply.Msg = "请验证参数正确性"
		return c.Status(r.Reply.Code).JSON(r.Reply)
	}
	var id int64
	var name string
	err := r.db.QueryRow(`SELECT id, name FROM users WHERE id = ? AND name = ?`, postBody.UserId, postBody.UserName).Scan(&id, &name)
	if err != nil && err != sql.ErrNoRows {
		r.Reply.Code = http.StatusOK
		r.Reply.Msg = "确保数据正确"
		r.Reply.Data = err
		return c.Status(r.Reply.Code).JSON(r.Reply)
	}
	token, err := CreateToken("guest", id, name)
	if err != nil {
		r.Reply.Code = http.StatusOK
		r.Reply.Msg = "创建token失败"
		r.Reply.Data = nil
		return c.Status(r.Reply.Code).JSON(r.Reply)
	}
	r.Reply.Code = http.StatusOK
	r.Reply.Msg = "完成"
	r.Reply.Data = map[string]any{
		"token": token,
	}
	c.Cookie(&fiber.Cookie{
		Name:     "ldtoken",
		Value:    token,
		Path:     "/",
		Expires:  time.Now().Add(24 * time.Hour),
		HTTPOnly: true,
		Secure:   false,
		SameSite: "Lax",
	})
	return c.Status(r.Reply.Code).JSON(r.Reply)
}

func (r Router) unBindUser(c *fiber.Ctx) error {
	postBody := struct {
		UserId   int64  `json:"userId"`
		UserName string `json:"userName"`
	}{}
	if err := c.BodyParser(&postBody); err != nil {
		r.Reply.Code = http.StatusBadRequest
		r.Reply.Msg = "请验证参数正确性"
		r.Reply.Data = err
		return c.Status(r.Reply.Code).JSON(r.Reply)
	}

	if postBody.UserId == 0 || postBody.UserName == "" {
		r.Reply.Code = http.StatusBadRequest
		r.Reply.Msg = "请验证参数正确性"
		return c.Status(r.Reply.Code).JSON(r.Reply)
	}
	result, err := r.db.Exec(`DELETE FROM users WHERE id = ? AND name = ?`, postBody.UserId, postBody.UserName)
	if err != nil {
		r.Reply.Code = http.StatusBadRequest
		r.Reply.Msg = "出错了哦"
		r.Reply.Data = err
		return c.Status(r.Reply.Code).JSON(r.Reply)
	}
	affectedId, _ := result.RowsAffected()
	r.Reply.Code = http.StatusOK
	r.Reply.Msg = "完成"
	r.Reply.Data = affectedId
	return c.Status(r.Reply.Code).JSON(r.Reply)
}

func (r Router) appLogin(c *fiber.Ctx) error {
	postBody := map[string]string{}
	clientIP := c.IP()
	if forwardedFor := c.Get("X-Forwarded-For"); forwardedFor != "" {
		// 如果有代理，取第一个IP（最原始客户端IP）
		ips := strings.Split(forwardedFor, ",")
		clientIP = strings.TrimSpace(ips[0])
	}
	if err := c.BodyParser(&postBody); err != nil {
		r.Reply.Code = http.StatusBadRequest
		r.Reply.Msg = "请验证参数正确性"
		r.Reply.Data = err
		return c.Status(r.Reply.Code).JSON(r.Reply)
	}
	if postBody["adminName"] == "" || postBody["adminPassword"] == "" || postBody["timeStamp"] == "" {
		r.Reply.Code = http.StatusBadRequest
		r.Reply.Msg = "缺少必要参数"
		r.Reply.Data = nil
		return c.Status(r.Reply.Code).JSON(r.Reply)
	}
	var adminId int64
	var adminName, adminRole string
	err := r.db.QueryRow("SELECT id, name, role FROM users WHERE name = ? AND pwd = ?", postBody["adminName"], postBody["adminPassword"]).Scan(&adminId, &adminName, &adminRole)
	if err != nil && err == sql.ErrNoRows {
		result, err := r.db.Exec(`INSERT INTO users (name, pwd, role,  ip, createdAt) VALUES (?, ?, ?, ?, ?);`, postBody["adminName"], postBody["adminPassword"], "admin", clientIP, time.Now().Format("2006-01-02 15:04:05"))
		if err != nil {
			r.Reply.Code = http.StatusBadRequest
			r.Reply.Msg = "创建失败1"
			r.Reply.Data = err
			return c.Status(r.Reply.Code).JSON(r.Reply)
		}
		insertId, _ := result.LastInsertId()
		adminId = insertId
		adminName = postBody["adminName"]
		adminRole = "admin"
	} else if err != nil {
		r.Reply.Code = http.StatusBadRequest
		r.Reply.Msg = "创建失败2"
		r.Reply.Data = err
		return c.Status(r.Reply.Code).JSON(r.Reply)
	}
	token, err := CreateToken(adminRole, adminId, adminName)
	if err != nil {
		r.Reply.Code = http.StatusOK
		r.Reply.Msg = "创建token失败"
		r.Reply.Data = nil
		return c.Status(r.Reply.Code).JSON(r.Reply)
	}
	r.Reply.Code = http.StatusOK
	r.Reply.Msg = "完成"
	r.Reply.Data = map[string]any{
		"token":     token,
		"adminId":   adminId,
		"adminName": adminName,
	}
	return c.Status(r.Reply.Code).JSON(r.Reply)
}

func (r Router) getWSStatus(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{
		"active_connections": wsHub.GetActiveConnections(),
		"status":             "running",
	})
}
