package server

import (
	"LanDrop/client/db"
	"context"
	"database/sql"
	"embed"
	"fmt"
	"log"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gofiber/contrib/websocket"
	"github.com/gofiber/fiber/v2"
	"github.com/shirou/gopsutil/v4/cpu"
	"github.com/shirou/gopsutil/v4/mem"
	psNet "github.com/shirou/gopsutil/v4/net"
)

// 全局WebSocket Hub实例
var wsHub *WSHub

func startRouter(app *fiber.App, assets embed.FS, config Config, sldb db.SqlliteDB, userDir string) {
	ctx := context.Background()
	wsHub = NewWSHub(ctx, sldb)
	go wsHub.Run()
	r := Router{
		app:     app,
		assets:  assets,
		config:  config,
		db:      sldb,
		userDir: userDir,
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
		if tokenJWT.Role != "admin+" && tokenJWT.Role != "admin" && tokenJWT.Role != "guest" { // 验证角色权限 - 修复逻辑判断
			sendErrorAndClose(conn, "token角色验证失败")
			return
		}
		userId, _ := strconv.ParseInt(id, 10, 64)
		if tokenJWT.UserID != userId { // token账号与传入id比对
			sendErrorAndClose(conn, "token账号验证失败")
			return
		}
		// 创建客户端
		wsClient := NewWSClient(conn, wsHub, sldb, tokenJWT, userId, name)

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
		// 获取用户列表信息
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
		// 获取配置信息
		api.Get("/getConfigData", r.getConfigData)
		// 更新用户信息
		api.Post("/updateUserInfo", r.updateUserInfo)
		// 上传用户聊天文件例如图片、文件
		api.Post("/uploadChatFiles", r.uploadChatFiles)
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
	rows, err := r.db.DB.Query("SELECT * FROM files")
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
	row := r.db.DB.QueryRow("SELECT * FROM files WHERE fileCode = ?", fileCode)
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
	rows, err := r.db.DB.Query(`SELECT * FROM "users" WHERE ip = ? AND role= 'guest'`, clientIP)
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
	row := r.db.DB.QueryRow(`SELECT COUNT(ip) as countIP FROM "users" WHERE ip = ? AND role = 'guest'`, clientIP)
	countIP := 0
	row.Scan(&countIP)
	if countIP >= 5 {
		r.Reply.Code = -1
		r.Reply.Msg = "当前ip地址已经注册超过五台设备，请先解绑后进行注册。"
		r.Reply.Data = nil
		return c.Status(http.StatusOK).JSON(r.Reply)
	}
	result, err := r.db.DB.Exec(`INSERT INTO users (name, nickName, pwd, role, ip, createdAt) VALUES (?, ?, ?, ?, ?, ?);`, generateName(), postBody["userName"], postBody["userName"]+"#123", "guest", clientIP, time.Now().Format("2006-01-02 15:04:05"))
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
	err := r.db.DB.QueryRow(`SELECT id, name FROM users WHERE id = ? AND name = ?`, postBody.UserId, postBody.UserName).Scan(&id, &name)
	if err != nil && err != sql.ErrNoRows {
		r.Reply.Code = http.StatusOK
		r.Reply.Msg = "确保数据正确"
		r.Reply.Data = err
		return c.Status(r.Reply.Code).JSON(r.Reply)
	}
	token, err := CreateToken("guest", id, name, r.config.TokenExpiryTime)
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
		Expires:  time.Now().Add(time.Duration(r.config.TokenExpiryTime) * time.Hour),
		HTTPOnly: true,
		Secure:   false,
		SameSite: "Lax",
	})
	return c.Status(r.Reply.Code).JSON(r.Reply)
}

func (r Router) unBindUser(c *fiber.Ctx) error {
	token := c.Locals("userToken").(*UserToken)
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
	if postBody.UserId != token.UserID {
		r.Reply.Code = http.StatusBadRequest
		r.Reply.Msg = "账号验证失败"
		return c.Status(r.Reply.Code).JSON(r.Reply)
	}
	result, err := r.db.Exec(`DELETE FROM users WHERE id = ? AND name = ?`, token.UserID, postBody.UserName)
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
	// var adminId int64
	// var adminName, adminRole, nickName string
	adminUserList := r.db.QueryList("SELECT id, name, nickName, role, avatar FROM users WHERE (name = ? OR id = ?) AND pwd = ?", postBody["adminName"], postBody["adminName"], postBody["adminPassword"])
	// err := r.db.DB.QueryRow("SELECT id, name, nickName, role FROM users WHERE (nickName = ? OR name = ?) AND pwd = ?", postBody["adminName"], postBody["adminName"], postBody["adminPassword"]).Scan(&adminId, &adminName, &nickName, &adminRole)
	if len(adminUserList) != 1 {
		r.Reply.Code = http.StatusBadRequest
		r.Reply.Msg = "管理员账号或密码错误"
		r.Reply.Data = "login failed."
		return c.Status(r.Reply.Code).JSON(r.Reply)
		// result, err := r.db.Exec(`INSERT INTO users ( name, nickName, pwd, role, ip, createdAt) VALUES (?, ?, ?, ?, ?, ?);`, postBody["adminName"], "管理员", postBody["adminPassword"], "admin", clientIP, time.Now().Format("2006-01-02 15:04:05"))
		// if err != nil {
		// 	r.Reply.Code = http.StatusBadRequest
		// 	r.Reply.Msg = "创建失败1"
		// 	r.Reply.Data = err
		// 	return c.Status(r.Reply.Code).JSON(r.Reply)
		// }
		// insertId, _ := result.LastInsertId()
		// adminUserList = r.db.QueryList("SELECT id, name, nickName, role, avatar FROM users WHERE id = ?", insertId)
	}

	adminUser := adminUserList[0]
	adminId := adminUser["id"].(int64)
	r.db.Exec(`UPDATE users SET ip = ? WHERE id = ?`, clientIP, adminId)
	token, err := CreateToken(adminUser["role"].(string), adminId, adminUser["name"].(string), 100*365*24) // 设置app端token长期有效100年
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
		"adminName": adminUser["name"],
		"nickName":  adminUser["nickName"],
		"role":      adminUser["role"],
		"avatar":    adminUser["avatar"],
	}
	return c.Status(r.Reply.Code).JSON(r.Reply)
}

func (r Router) getWSStatus(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{
		"active_connections": wsHub.GetActiveConnections(),
		"status":             "running",
	})
}

func (r Router) getConfigData(c *fiber.Ctx) error {
	r.Reply.Code = http.StatusOK
	r.Reply.Msg = "successed"
	r.Reply.Data = r.config
	return c.Status(r.Reply.Code).JSON(r.Reply)
}

func (r Router) updateUserInfo(c *fiber.Ctx) error {
	token := c.Locals("userToken").(*UserToken)
	postBody := map[string]any{}
	if err := c.BodyParser(&postBody); err != nil {
		r.Reply.Code = http.StatusBadRequest
		r.Reply.Msg = "请验证参数正确性"
		r.Reply.Data = err
		return c.Status(r.Reply.Code).JSON(r.Reply)
	}
	var result sql.Result
	if postBody["avatar"] != nil && postBody["nickName"] == nil {
		result, _ = r.db.Exec(`UPDATE users SET avatar = ? WHERE id = ?`, postBody["avatar"], token.UserID)
	} else if postBody["nickName"] != nil && postBody["avatar"] == nil {
		result, _ = r.db.Exec(`UPDATE users SET nickName = ? WHERE id = ?`, postBody["nickName"], token.UserID)
	} else if postBody["avatar"] != nil && postBody["nickName"] != nil {
		result, _ = r.db.Exec(`UPDATE users SET avatar = ?, nickName = ? WHERE id = ?`, postBody["avatar"], postBody["nickName"], token.UserID)
	}
	if _, err := result.RowsAffected(); err != nil {
		r.Reply.Code = http.StatusBadRequest
		r.Reply.Msg = "失败"
		r.Reply.Data = "修改失败"
	} else {
		r.Reply.Code = http.StatusOK
		r.Reply.Msg = "完成"
		r.Reply.Data = "修改成功"
	}

	return c.Status(r.Reply.Code).JSON(r.Reply)
}

func (r Router) uploadChatFiles(c *fiber.Ctx) error {
	form, err := c.MultipartForm()
	if err != nil {
		r.Reply.Code = http.StatusBadRequest
		r.Reply.Msg = "上传失败,无法解析表单数据"
		return c.Status(r.Reply.Code).JSON(r.Reply)
	}
	files := form.File["files"] // 支持多文件上传
	if len(files) == 0 {
		r.Reply.Code = http.StatusBadRequest
		r.Reply.Msg = "未上传任何文件"
		return c.Status(r.Reply.Code).JSON(r.Reply)
	}
	// 2. 并发处理上传（使用 goroutine 池）
	type uploadResult struct {
		Name string `json:"name"`
		URL  string `json:"url"`
		Size int64  `json:"size"`
		Err  error  `json:"err"`
	}
	results := make(chan uploadResult, len(files))
	var wg sync.WaitGroup
	// 限制并发数（与前端 maxConcurrent 匹配）
	maxConcurrent := 5
	semaphore := make(chan struct{}, maxConcurrent)
	for _, file := range files {
		wg.Add(1)
		go func(f *multipart.FileHeader) {
			defer wg.Done()
			semaphore <- struct{}{} // 获取信号量
			defer func() { <-semaphore }()
			result := uploadResult{
				Name: f.Filename,
				Size: f.Size,
			}
			// 3. 安全校验
			// if !isAllowedFileType(f.Filename) {
			//     result.Err = fmt.Errorf("禁止的文件类型: %s", filepath.Ext(f.Filename))
			//     results <- result
			//     return
			// }
			// 4. 生成唯一文件名（避免冲突）
			newFilename := generateFilename(f.Filename)
			userDir := fmt.Sprintf("%v/%v", time.Now().Format("2006_01"), "test")
			savePath := filepath.Join(r.userDir, userDir)
			// 检测文件夹是否存在
			if err := os.MkdirAll(savePath, 0755); err != nil {
				result.Err = fmt.Errorf("无法创建上传目录: %v", err)
				results <- result
				return
			}
			// 5. 保存文件
			if err := c.SaveFile(f, filepath.Join(savePath, newFilename)); err != nil {
				result.Err = fmt.Errorf("文件保存失败: %v", err)
				results <- result
				return
			}
			// 6. 返回可访问的 URL（生产环境替换为 CDN 地址）
			result.URL = fmt.Sprintf("/user/%s/%s", userDir, newFilename)
			results <- result
		}(file)
	}
	// 等待所有任务完成
	go func() {
		wg.Wait()
		close(results)
	}()
	// 7. 收集结果
	var successFiles []uploadResult
	var errorMessages []string
	for res := range results {
		if res.Err != nil {
			errorMessages = append(errorMessages, fmt.Sprintf("%s: %v", res.Name, res.Err))
		} else {
			successFiles = append(successFiles, res)
		}
	}
	// 8. 统一响应
	if len(errorMessages) > 0 {
		r.Reply.Code = http.StatusPartialContent
		r.Reply.Msg = fmt.Sprintf("部分文件上传失败: %s", strings.Join(errorMessages, "; "))
		r.Reply.Data = successFiles
		return c.Status(r.Reply.Code).JSON(r.Reply)
	}
	r.Reply.Code = http.StatusOK
	r.Reply.Msg = "所有文件上传成功"
	r.Reply.Data = successFiles
	return c.Status(r.Reply.Code).JSON(r.Reply)
}
