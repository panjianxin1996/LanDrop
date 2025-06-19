package server

import (
	"database/sql"
	"embed"
	"encoding/json"
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
	app           *fiber.App
	assets        embed.FS
	sharedDirPath string
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

func startRouter(app *fiber.App, assets embed.FS, sharedDirPath string, db *sql.DB) {
	r := Router{
		app:           app,
		assets:        assets,
		sharedDirPath: sharedDirPath,
		db:            db,
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
		defer conn.Close()

		// 每隔 3 秒发送消息
		ticker := time.NewTicker(3 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
				// 发送当前时间戳
				sendData := map[string]any{}
				sendData["type"] = "deviceRealTimeInfo"
				sendData["time"] = time.Now().Format("2006-01-02 15:04:05")
				// cpu利用率
				cpuUsage, _ := cpu.Percent(time.Second, false)
				sendData["cpuUsage"] = cpuUsage[0]
				// 内存利用率
				memInfo, _ := mem.VirtualMemory()
				sendData["memUsage"] = memInfo.UsedPercent
				// 网络吞吐量
				initialStats, _ := psNet.IOCounters(true)
				time.Sleep(1 * time.Second)
				currentStats, _ := psNet.IOCounters(true)
				adapterList := []map[string]string{}
				// 计算增量
				for i, stat := range currentStats {
					if stat.Name == initialStats[i].Name {
						upload := stat.BytesSent - initialStats[i].BytesSent
						download := stat.BytesRecv - initialStats[i].BytesRecv
						// adapterCode := fmt.Sprintf("netAdapter_%v", i)
						adapterList = append(adapterList, map[string]string{
							"adapterCode": stat.Name,
							"adapterName": stat.Name,
						})
						sendData[stat.Name] = map[string]any{
							"adapterCode": stat.Name,
							"adapterName": stat.Name,
							"upload":      upload,
							"download":    download,
						}
					}
				}
				sendData["adapterList"] = adapterList
				if sendByte, jErr := json.Marshal(sendData); jErr == nil {
					if err := conn.WriteMessage(websocket.TextMessage, sendByte); err != nil {
						log.Println("write:", err)
						return
					}
				}
			}
		}
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
		// 在路由中使用
		api.Post("/createUser", r.createUser)
		// app.Get("/setSharedDir", r.setSharedDir)
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
	if err := c.SaveFile(file, filepath.Join(r.sharedDirPath, file.Filename)); err != nil {
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
			"sharedDir": r.sharedDirPath,
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
	row := r.db.QueryRow(`SELECT COUNT(ip) as countIP FROM "users" WHERE ip = ?`, clientIP)
	countIP := 0
	row.Scan(&countIP)
	if countIP >= 5 {
		r.Reply.Code = http.StatusOK
		r.Reply.Msg = "当前ip地址已经注册超过五台设备，请先申请解锁。"
		r.Reply.Data = nil
		return c.Status(r.Reply.Code).JSON(r.Reply)
	}
	result, err := r.db.Exec(`INSERT INTO users (name, role, ip, createdAt) VALUES (?, ?, ?, ?);`, postBody["userName"], "guest", clientIP, time.Now().Format("2006-01-02 15:04:05"))
	if err != nil {
		r.Reply.Code = http.StatusBadRequest
		r.Reply.Msg = "创建失败"
		r.Reply.Data = nil
		return c.Status(r.Reply.Code).JSON(r.Reply)
	}
	insertId, _ := result.LastInsertId()
	token, err := CreateToken(insertId, postBody["userName"])
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
	return c.Status(r.Reply.Code).JSON(r.Reply)
}
