package server

import (
	"LanDrop/client/db"
	"LanDrop/client/fsListen"
	"context"
	"embed"
	"encoding/json"
	"fmt"
	"log"
	"net"
	"net/http"
	"net/url"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/filesystem"
	_ "github.com/mattn/go-sqlite3"
)

var (
	app         *fiber.App
	serverMutex sync.Mutex
	shutdownCtx context.Context
	cancelFunc  context.CancelFunc
)

// 初始化上下文和取消函数
func init() {
	shutdownCtx, cancelFunc = context.WithCancel(context.Background())
}

type Config struct {
	AppName    string `json:"appName"`
	Port       int    `json:"port"`
	DefaultDir string `json:"defaultDir"`
	Version    string `json:"version"`
}

// 检查端口是否占用
func isPortAvailable(port int) bool {
	conn, err := net.DialTimeout("tcp", fmt.Sprintf(":%d", port), 2*time.Second)
	if err == nil {
		conn.Close()
		return false
	}
	return true
}

// 获取当前程序所在目录
func getAppDir() string {
	exePath, _ := os.Executable()
	return filepath.Dir(exePath)
}

// 创建共享目录
func createSharedDir(appDir string) string {
	// 拼接 shared 目录路径
	sharedDir := filepath.Join(appDir, "shared")
	// 检查目录是否存在
	if _, err := os.Stat(sharedDir); os.IsNotExist(err) {
		// 目录不存在，创建
		err = os.Mkdir(sharedDir, os.ModePerm) // 权限 0777
		if err != nil {
			log.Println("创建 shared 目录失败:", err)
			return ""
		}
	} else if err != nil {
		// 其他错误（如权限问题）
		log.Println("检查 shared 目录失败:", err)
		return ""
	}
	return sharedDir
}

// 加载配置文档
func LoadConfigFile() (Config, error) {
	appDir := getAppDir()
	configFile := filepath.Join(appDir, "config.json")
	if _, err := os.Stat(configFile); os.IsNotExist(err) { // 检查配置文件是否存在
		defaultConfig := Config{ // 创建默认配置
			AppName:    "LanDrop",
			Port:       4321,
			DefaultDir: "",
			Version:    "0.0.1",
		}
		sharedDir := createSharedDir(appDir) // 创建默认分享目录
		if sharedDir == "" {
			return defaultConfig, fmt.Errorf("创建默认目录失败")
		}
		defaultConfig.DefaultDir = sharedDir
		file, err := os.Create(configFile) // 将默认配置写入文件
		if err != nil {
			return defaultConfig, err
		}
		defer file.Close()
		encoder := json.NewEncoder(file)
		encoder.SetIndent("", "    ") // 设置缩进，使文件更易读
		if err := encoder.Encode(defaultConfig); err != nil {
			return defaultConfig, err
		}
		return defaultConfig, nil
	} else {
		var config Config
		file, err := os.Open(configFile)
		if err != nil {
			return config, err
		}
		defer file.Close()
		decoder := json.NewDecoder(file)
		if err := decoder.Decode(&config); err != nil {
			return config, err
		}
		return config, nil
	}
}

// 保存配置文档
func SaveConfigFile(config Config) error {
	appDir := getAppDir()
	configFile := filepath.Join(appDir, "config.json")

	file, err := os.Create(configFile)
	if err != nil {
		return err
	}
	defer file.Close()
	encoder := json.NewEncoder(file)
	encoder.SetIndent("", "    ")
	return encoder.Encode(config)
}

// 启动服务器
func Run(assets embed.FS) {
	serverMutex.Lock()
	defer serverMutex.Unlock()
	// 初始化数据库
	db, err := db.InitDB(filepath.Join(getAppDir(), "app.db"))
	if err != nil {
		log.Printf("数据库初始化失败: %v", err)
		return
	}
	// 加载配置文件
	config, err := LoadConfigFile()
	if err != nil {
		log.Println(err.Error())
		return
	}
	// 启动监听目录【使用goroutine避免阻塞进程】
	go fsListen.FSWatcher(config.DefaultDir, db)
	if !isPortAvailable(config.Port) {
		log.Println(fmt.Printf("端口 %v 已被占用，跳过 Fiber 启动", config.Port))
		return
	}
	// 初始化 Fiber 应用
	app = fiber.New(fiber.Config{
		Prefork:      false,             // 启用多核并行处理
		ErrorHandler: errorHandler,      // 全局错误处理
		BodyLimit:    500 * 1024 * 1024, // 最大支持500MB
	})
	// 完全跨域允许
	// app.Use(cors.New())
	// 设置跨域允许
	app.Use(cors.New(cors.Config{
		// 在AllowOrigins之后触发，放行所有4321端口的请求
		AllowOriginsFunc: func(origin string) bool {
			parsed, err := url.Parse(origin)
			if err != nil {
				return false
			}
			return parsed.Port() == "4321" // 仅允许4321端口
		},
		AllowOrigins: "http://wails.localhost:34115,http://wails.localhost,wails://wails.localhost:34115,wails://wails", // windows协议为http://,macOS协议为wails://
		AllowMethods: strings.Join([]string{
			fiber.MethodGet,
			fiber.MethodPost,
			fiber.MethodHead,
			fiber.MethodPut,
			fiber.MethodDelete,
			fiber.MethodPatch,
			fiber.MethodOptions,
		}, ","),
		AllowHeaders:     "*",
		AllowCredentials: true,
		ExposeHeaders:    "*",
	}))

	// 中间件：请求日志
	app.Use(func(c *fiber.Ctx) error {
		log.Printf("[%s] %s\n", c.Method(), c.Path())
		return c.Next()
	})

	// 将wails前端资源挂载到根路径下，wails静态资源会在应用启动时候读取加载到内存中虚拟目录。
	app.Use("/", filesystem.New(filesystem.Config{
		Root:       http.FS(assets),
		PathPrefix: "frontend/dist", // 匹配嵌入的路径
		Browse:     true,            // 允许目录浏览（可选）
	}))
	app.Static("/shared", config.DefaultDir)

	// 启动路由组
	startRouter(app, assets, config.DefaultDir, db)

	// 404 处理
	app.Use(func(c *fiber.Ctx) error {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"code": 404,
			"msg":  "This page does not exist.",
			"data": "Not found",
		})
	})

	// 启动服务（异步）
	go func() {
		log.Println(fmt.Sprintf("服务启动中，监听端口 :%v", config.Port))
		if err := app.Listen(fmt.Sprintf(":%v", config.Port)); err != nil {
			log.Fatal("服务启动失败:", err)
		}
	}()

	// 监听终止信号
	go handleSignals()
}

// Stop 停止服务
func Stop() {
	serverMutex.Lock()
	defer serverMutex.Unlock()

	if app == nil {
		log.Println("服务未启动，无需停止")
		return
	}
	if err := app.Shutdown(); err != nil {
		log.Fatal("强制关闭服务失败:", err)
	}
	cancelFunc() // 通知所有阻塞的goroutine退出
	log.Println("服务已停止")
}

// Restart 重启服务
func Restart(assets embed.FS) {
	Stop()
	time.Sleep(1 * time.Second) // 等待资源释放
	Run(assets)
}

// 信号处理
func handleSignals() {
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	select {
	case sig := <-sigChan:
		log.Printf("接收到信号: %v\n", sig)
		Stop()
	case <-shutdownCtx.Done():
		return // 主动调用Stop时退出
	}
}

// 全局错误处理
func errorHandler(c *fiber.Ctx, err error) error {
	code := fiber.StatusInternalServerError
	if e, ok := err.(*fiber.Error); ok {
		code = e.Code
	}
	return c.Status(code).JSON(fiber.Map{
		"code": 500,
		"msg":  "Error occurred.",
		"data": err.Error(),
	})
}
