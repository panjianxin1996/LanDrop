package server

import (
	"crypto/rand"
	"embed"
	"encoding/json"
	"log"
	"math/big"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"sync"
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
}

type Reply struct {
	Code int    `json:"code"`
	Msg  string `json:"msg"`
	Data any    `json:"data"`
}

var pathMap sync.Map // 路径映射

// 获取随机code码
func generateRandomCode(length int) string {
	const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
	code := make([]byte, length)
	for i := range code {
		n, err := rand.Int(rand.Reader, big.NewInt(int64(len(charset))))
		if err != nil {
			return "generateRandomCode_error"
		}
		code[i] = charset[n.Int64()]
	}
	return string(code)
}

// 添加映射
func addMapping(code, realPath string) {
	pathMap.Store(code, realPath)
}

// 获取真实路径
func getRealPath(code string) (string, bool) {
	value, ok := pathMap.Load(code)
	if !ok {
		return "", false
	}
	return value.(string), true
}

func startRouter(app *fiber.App, assets embed.FS, sharedDirPath string) {
	r := Router{
		app:           app,
		assets:        assets,
		sharedDirPath: sharedDirPath,
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
	entries, err := os.ReadDir(r.sharedDirPath)
	if err != nil {
		r.Reply = Reply{
			Code: http.StatusNotModified,
			Msg:  "failed",
			Data: nil,
		}
		return c.Status(r.Reply.Code).JSON(r.Reply)
	}
	files := []FileInfo{}
	for _, entry := range entries {
		info, _ := entry.Info()
		fileId := generateRandomCode(8)
		addMapping(fileId, "/shared/"+url.PathEscape(entry.Name()))
		files = append(files, FileInfo{
			Name:    entry.Name(),
			Size:    info.Size(),
			Mode:    info.Mode().String(),
			ModTime: info.ModTime(),
			IsDir:   entry.IsDir(),
			URIName: url.PathEscape(entry.Name()),
			Path:    "/shared/" + url.PathEscape(entry.Name()),
			FileId:  fileId,
		})
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
	fileId := c.Query("fileId")
	if path, ok := getRealPath(fileId); ok {
		r.Reply.Code = 200
		r.Reply.Data = path
		r.Reply.Msg = "successed"
	} else {
		r.Reply.Code = -1
		r.Reply.Data = ""
		r.Reply.Msg = "get real path failed"
	}
	return c.Status(r.Reply.Code).JSON(r.Reply)
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
		log.Println("设置地址失败", err)
		r.Reply.Code = http.StatusBadRequest
		r.Reply.Msg = "parse body failed."
		r.Reply.Data = err
	} else {
		log.Println("设置地址成功", postBody["ipv4"], postBody["ipv6"])
		SetAppIPv4(postBody["ipv4"])
		SetAppIPv6(postBody["ipv6"])
		r.Reply.Code = http.StatusOK
		r.Reply.Msg = "set ip success."
	}
	return c.Status(r.Reply.Code).JSON(r.Reply)
}
