package server

import (
	"embed"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
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
						adapterCode := fmt.Sprintf("netAdapter_%v", i)
						adapterList = append(adapterList, map[string]string{
							"adapterCode": adapterCode,
							"adapterName": stat.Name,
						})
						sendData[adapterCode] = map[string]any{
							"adapterCode": adapterCode,
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
		files = append(files, FileInfo{
			Name:    entry.Name(),
			Size:    info.Size(),
			Mode:    info.Mode().String(),
			ModTime: info.ModTime(),
			IsDir:   entry.IsDir(),
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
