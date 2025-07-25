package server

import (
	"LanDrop/client/db"
	"LanDrop/client/fsListen"
	"context"
	"database/sql"
	"embed"
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

	jwtware "github.com/gofiber/contrib/jwt"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/filesystem"
	"github.com/golang-jwt/jwt/v5"
	_ "github.com/mattn/go-sqlite3"
)

var (
	app         *fiber.App         // fiber
	proxyApp    *http.Server       // 反向代理服务器
	serverMutex sync.Mutex         // 服务器状态锁
	shutdownCtx context.Context    // 上下文
	cancelFunc  context.CancelFunc // 取消函数
	slDB        db.SqlliteDB       // sqlite数据库
	AppDir      string             // 进程所在目录
	AppErr      error              // 错误信息
)

// 获取当前程序所在目录
func getAppDir() string {
	exePath, _ := os.Executable()
	return filepath.Dir(exePath)
}

// 初始化上下文和取消函数
func init() {
	shutdownCtx, cancelFunc = context.WithCancel(context.Background())
	AppDir = getAppDir()
	// 数据库连接
	slDB, AppErr = db.InitDB(filepath.Join(AppDir, "app.db"))
}

type Config struct {
	AppName         string `json:"appName"`
	Port            int    `json:"port"`
	SharedDir       string `json:"sharedDir"`
	Version         string `json:"version"`
	TokenExpiryTime int    `json:"tokenExpiryTime"`
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

// 创建共享目录
func createDir(appDir string, childDir string) string {
	subDir := filepath.Join(appDir, childDir)
	if _, err := os.Stat(subDir); os.IsNotExist(err) {
		err = os.Mkdir(subDir, os.ModePerm) // 权限 0777
		if err != nil {
			log.Println("创建 shared 目录失败:", err)
			return ""
		}
	} else if err != nil {
		log.Println("检查 shared 目录失败:", err)
		return ""
	}
	return subDir
}

func GetSettingInfo() Config {
	d := Config{ // 创建默认配置
		AppName:         "",
		Port:            0,
		SharedDir:       "",
		Version:         "",
		TokenExpiryTime: 0,
	}
	err := slDB.DB.QueryRow(`SELECT appName, port,sharedDir ,version, tokenExpiryTime FROM settings WHERE name = 'config'`).Scan(&d.AppName, &d.Port, &d.SharedDir, &d.Version, &d.TokenExpiryTime)
	if err != nil && err == sql.ErrNoRows {
		sharedDir := createDir(AppDir, "shared") // 创建默认分享目录
		d.AppName = "LanDrop"
		d.Port = 4321
		d.SharedDir = sharedDir
		d.Version = "V1.0.0"
		d.TokenExpiryTime = 24
		nowDate := time.Now().Format("2006-01-02 15:04:05")
		if _, err := slDB.DB.Exec(`INSERT INTO settings (name, appName, port, sharedDir, version, tokenExpiryTime, createdAt, modifiedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, "config", d.AppName, d.Port, d.SharedDir, d.Version, d.TokenExpiryTime, nowDate, nowDate); err != nil {
			log.Println("插入配置失败", err)
		}
		log.Println("没有数据插入数据", d)
	}
	log.Println("最终数据", d)
	return d
}

// 更新分享目录信息
func UpdateDirInfo(updateFields []string, updateValues []any) (sql.Result, error) {
	return slDB.DB.Exec(fmt.Sprintf(`UPDATE settings SET %v WHERE name = 'config'`, strings.Join(updateFields, ",")), updateValues...)
}

// 启动服务器
func Run(assets embed.FS) {
	serverMutex.Lock()
	defer serverMutex.Unlock()
	if AppErr != nil {
		log.Printf("数据库初始化失败: %v", AppErr)
		return
	}
	// 加载配置文件通过数据库
	config := GetSettingInfo()
	// 创建聊天用户上传的文件
	userDir := createDir(AppDir, "user")
	// 启动监听目录【使用goroutine避免阻塞进程】
	go fsListen.FSWatcher(config.SharedDir, slDB.DB)
	if !isPortAvailable(config.Port) {
		log.Println(fmt.Printf("端口 %v 已被占用，跳过 Fiber 启动", config.Port))
		return
	}
	// 初始化 Fiber 应用
	app = fiber.New(fiber.Config{
		Prefork:      false,                  // 启用多核并行处理
		ErrorHandler: errorHandler,           // 全局错误处理
		BodyLimit:    5 * 1024 * 1024 * 1024, // 最大支持500MB
	})
	// 完全跨域允许
	// app.Use(cors.New())
	// 设置跨域允许
	app.Use(cors.New(cors.Config{
		AllowOriginsFunc: func(origin string) bool {
			if origin == "" { // 允许空origin（如本地文件请求）
				return true
			}
			parsed, err := url.Parse(origin) // 解析URL
			if err != nil {
				return false
			}
			if parsed.Port() == fmt.Sprintf("%v", config.Port) { // 规则1：放行所有4321端口的请求
				return true
			}
			allowedOrigins := []string{ // 规则2：放行预定义的Wails相关来源
				"http://wails.localhost:34115",
				"http://wails.localhost",
				"wails://wails.localhost:34115",
				"wails://wails",
				"http://localhost:5173",
				"http://127.0.0.1:5173",
			}
			for _, allowed := range allowedOrigins {
				if origin == allowed {
					return true
				}
			}
			return false
		},
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
		contentType := c.Get("Content-Type")
		if strings.Contains(contentType, "multipart/form-data") { // 避免文件上传二进制被写入日志
			log.Printf("[%s]-|%s | %s\n", c.Method(), c.Path(), c.IP())
			return c.Next()
		}
		log.Printf("[%s]-|%s | %s | %s\n", c.Method(), c.Path(), c.IP(), string(c.Request().Body()))
		return c.Next()
	})

	skipPrefixes := []string{"/", "/assets/", "/#/", "/shared/",
		"/ws", "/api/v1/getUserList", "/api/v1/createToken",
		"/api/v1/createUser", "/api/v1/appLogin",
	}

	app.Use(func(c *fiber.Ctx) error {
		for _, prefix := range skipPrefixes {
			if prefix == "/" {
				if c.Path() == "/" { // 严格匹配根路径
					c.Locals("skipToken", true)
					break
				}
			} else if strings.HasPrefix(c.Path(), prefix) {
				c.Locals("skipToken", true)
				break
			}
		}
		return c.Next()
	})

	// JWT中间件配置
	jwtConfig := jwtware.Config{
		SigningKey:  jwtware.SigningKey{Key: SecretKey},
		TokenLookup: "query:token,cookie:ldtoken,header:X-Ld-Token",
		ContextKey:  "user",
		Claims:      &UserToken{},
		TokenProcessorFunc: func(encryptedToken string) (string, error) { // 对加密token进行解密然后进行下一步
			decryptedToken, err := DecryptToken(encryptedToken)
			if err != nil {
				return "", fmt.Errorf("token解密失败: %v", err)
			}
			return decryptedToken, nil
		},
		SuccessHandler: func(c *fiber.Ctx) error { // 验证成功后，将用户信息存储在Context中
			user := c.Locals("user").(*jwt.Token)
			claims := user.Claims.(*UserToken)
			c.Locals("userToken", claims)
			return c.Next()
		},
		ErrorHandler: func(c *fiber.Ctx, err error) error { // 验证失败
			if c.Locals("skipToken") == true {
				return c.Next()
			}
			return c.Status(401).JSON(fiber.Map{
				"code": -999,
				"data": nil,
				"msg":  "身份凭证过期或无效。请重新登录。",
			})
		},
	}

	// 应用JWT中间件
	app.Use(jwtware.New(jwtConfig))

	// 将wails前端资源挂载到根路径下，wails静态资源会在应用启动时候读取加载到内存中虚拟目录。
	app.Use("/", filesystem.New(filesystem.Config{
		Root:       http.FS(assets),
		PathPrefix: "frontend/dist", // 匹配嵌入的路径
		Browse:     true,            // 允许目录浏览（可选）
	}))
	app.Static("shared", config.SharedDir)

	app.Static("user", userDir)

	// 启动路由组
	startRouter(app, assets, config, slDB, userDir)

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
		log.Printf("服务启动中，监听端口 :%v", config.Port)
		if err := app.Listen(fmt.Sprintf(":%v", config.Port)); err != nil {
			log.Fatal("服务启动失败:", err)
		}

	}()

	go func() { // 启动反向代理服务器监听80端口转发到4321
		proxyServer, err := proxyServer()
		if err != nil {
			log.Println("代理服务启动失败:", err)
		}
		proxyApp = proxyServer
	}()

	// 监听终止信号
	go handleSignals()
}

// Stop 停止服务
func Stop() {
	serverMutex.Lock()
	defer serverMutex.Unlock()
	if app != nil {
		log.Println("正在关闭web服务")
		if err := app.Shutdown(); err != nil {
			log.Fatal("强制关闭服务失败:", err)
		}
		app = nil
	}
	if proxyApp != nil {
		log.Println("正在关闭代理服务...")
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second) // 创建5s上下文优雅退出
		defer cancel()
		if err := proxyApp.Shutdown(ctx); err != nil {
			log.Printf("代理服务关闭失败: %v", err)
		}
		proxyApp = nil
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
		// Stop()
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
