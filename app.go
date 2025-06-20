package main

import (
	"LanDrop/client/server"
	"context"
	"fmt"
	"os/exec"
	"runtime"

	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// App struct
type App struct {
	ctx context.Context
}

// NewApp creates a new App application struct
func NewApp() *App {

	return &App{}
}

// startup is called at application startup
func (a *App) startup(ctx context.Context) {
	// Perform your setup here
	a.ctx = ctx
}

// domReady is called after front-end resources have been loaded
func (a App) domReady(ctx context.Context) {
	// Add your action here
}

// beforeClose is called when the application is about to quit,
// either by clicking the window close button or calling runtime.Quit.
// Returning true will cause the application to continue, false will continue shutdown as normal.
func (a *App) beforeClose(ctx context.Context) (prevent bool) {
	return false
}

// shutdown is called at application termination
func (a *App) shutdown(ctx context.Context) {
	// Perform your teardown here
}

// Greet returns a greeting for the given name
func (a *App) Version() string {
	return "V1.0.0"
}

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

func (a *App) UpdateDefaultDir(dirPath string) map[string]any {
	updateBack := map[string]interface{}{}
	_, err := server.UpdateDirInfo(dirPath)
	// 3. 保存新配置
	if err != nil {
		updateBack["status"] = "error"
		updateBack["newDir"] = nil
		updateBack["msg"] = fmt.Errorf("保存配置失败: %v", err)
		return updateBack
	}
	updateBack["status"] = "success"
	updateBack["newDir"] = dirPath
	updateBack["msg"] = "保存成功"
	return updateBack
}

func (a *App) RestartServer() error {
	server.Restart(assets)
	return nil
}
