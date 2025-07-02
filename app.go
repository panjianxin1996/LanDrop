package main

import (
	"LanDrop/client/server"
	"LanDrop/client/tools"
	"context"
	"fmt"
	"log"
	"os/exec"
	"runtime"
	"time"

	"github.com/panjianxin1996/systray-heighten"

	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// App struct
type App struct {
	ctx      context.Context
	stopExit bool
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{
		stopExit: true,
	}
}

// startup is called at application startup
func (a *App) startup(ctx context.Context) {
	// Perform your setup here
	a.ctx = ctx
	// 启动web服务
	server.Run(assets)
	go server.StartDNSServer()
	go systray.Run(func() {
		systray.SetIcon(trayIcon)
		systray.SetTitle("LanDrop")
		systray.SetTooltip("LanDrop")
		systray.SetLeftClick(runtime.GOOS, func() {
			a.WindowShow()
			log.Println("左键埋点检测")
		})
		mShow := systray.AddMenuItem("显示窗口", "显示应用窗口")
		systray.AddSeparator()
		mQuit := systray.AddMenuItem("退出", "关闭应用")
		for {
			select {
			case <-mShow.ClickedCh:
				a.WindowShow()
				log.Println("右键埋点检测1")
			case <-mQuit.ClickedCh:
				// 退出应用
				log.Println("右键埋点检测2")
				a.ExitApp()
			}
		}
	}, nil)
}

// domReady is called after front-end resources have been loaded
func (a *App) domReady(ctx context.Context) {
	// Add your action here
}

// beforeClose is called when the application is about to quit,
// either by clicking the window close button or calling runtime.Quit.
// Returning true will cause the application to continue, false will continue shutdown as normal.
func (a *App) beforeClose(ctx context.Context) (prevent bool) {
	// return false // 默认关闭app
	if a.stopExit {
		a.WindowHide()
	}
	return a.stopExit
}

// shutdown is called at application termination
func (a *App) shutdown(ctx context.Context) {
	// Perform your teardown here
	server.Stop()
	server.StopDNSServer()
	systray.Quit()
}

// Greet returns a greeting for the given name
func (a *App) Version() string {
	return "V1.0.0"
}

// 退出应用
func (a *App) ExitApp() {
	log.Println("退出应用")
	a.stopExit = false
	wailsRuntime.Quit(a.ctx)
}

// 隐藏应用窗口
func (a *App) WindowHide() {
	wailsRuntime.WindowHide(a.ctx)
}

// 显示应用窗口
func (a *App) WindowShow() {
	wailsRuntime.WindowShow(a.ctx)
}

// 打开目录选择框
func (a *App) OpenDirectory() map[string]any {
	dirInfo := map[string]any{}
	selectedDir, err := wailsRuntime.OpenDirectoryDialog(a.ctx, wailsRuntime.OpenDialogOptions{
		Title:                "选择目录",
		DefaultDirectory:     "/",  // 默认打开的目录路径
		CanCreateDirectories: true, // 允许用户创建新目录
		ShowHiddenFiles:      true, // 显示隐藏文件/目录（部分系统需注意权限）
	})
	if err != nil {
		dirInfo["error"] = err.Error()
		return dirInfo
	}
	dirInfo["dir"] = selectedDir
	return dirInfo
}

// 资源管理器打开目录
func (a *App) OpenDirInExplorer(dirPath string) error {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "windows":
		cmd = exec.Command("explorer", dirPath) // Windows 使用 explorer
	case "darwin":
		cmd = exec.Command("open", dirPath) // macOS 使用 open
	case "linux":
		cmd = exec.Command("xdg-open", dirPath) // Linux 使用 xdg-open
	default:
		return nil
	}
	return cmd.Start()
}

// 更新默认目录
func (a *App) UpdateConfigData(updateData map[string]any) map[string]any {
	updateBack := map[string]any{}
	if len(updateData) == 0 {
		updateBack["status"] = "error"
		updateBack["msg"] = "缺少关键参数"
		return updateBack
	}
	// 避免注入风险
	validColumns := map[string]bool{
		"sharedDir":       true,
		"tokenExpiryTime": true,
	}
	updateFields := []string{}
	updateValues := []any{}
	for k, v := range updateData {
		if !validColumns[k] {
			updateBack["status"] = "error"
			updateBack["msg"] = "存在不允许更新的字段"
			return updateBack
		}
		updateFields = append(updateFields, k+"=?")
		updateValues = append(updateValues, v)
	}
	_, err := server.UpdateDirInfo(updateFields, updateValues)
	// 3. 保存新配置
	if err != nil {
		updateBack["status"] = "error"
		updateBack["msg"] = fmt.Errorf("保存配置失败: %v", err)
		return updateBack
	}
	updateBack["status"] = "success"
	updateBack["msg"] = "保存成功"
	return updateBack
}

// 重启服务
func (a *App) RestartServer() {
	server.Restart(assets)
}

// 工具类
func (a *App) ToolsPingHost(pingId any, host string) (map[string]any, error) {
	return tools.PingHost(pingId, host, 5, 5*time.Second)
}

func (a *App) GetAppConfig() server.Config {
	return server.GetSettingInfo()
}
