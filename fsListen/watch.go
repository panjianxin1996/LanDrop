package fsListen

import (
	"crypto/rand"
	"database/sql"
	"log"
	"math/big"
	"net/url"
	"os"

	"github.com/fsnotify/fsnotify"
)

func boolToInt(b bool) int {
	if b {
		return 1
	}
	return 0
}

func generateRandomCode(length int) string {
	const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
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
func FSWatcher(watchDir string, db *sql.DB) {
	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		log.Println("[x]开启监听:", err)
		return
	}
	defer watcher.Close()

	// 读取目录进行映射到数据库
	db.Exec(`DROP TABLE IF EXISTS files;`)
	if _, err := db.Exec(`
		CREATE TABLE IF NOT EXISTS files (
			fileId INTEGER PRIMARY KEY AUTOINCREMENT,
			fileName TEXT NOT NULL,
			fileSize INTEGER NOT NULL,
			fileMode  TEXT NOT NULL,
			fileModTime TEXT NOT NULL,
			isDir   INTEGER NOT NULL,
			uriName TEXT NOT NULL,
			path  TEXT NOT NULL,
			fileCode TEXT NOT NULL
		)
	`); err != nil {
		log.Println("[x]创建表结构:", err)
		return
	}
	entries, _ := os.ReadDir(watchDir)
	for _, entry := range entries {
		info, _ := entry.Info()
		fileId := generateRandomCode(8)
		if _, err := db.Exec(`INSERT INTO files (fileName, fileSize, fileMode, fileModTime, isDir,uriName, path, fileCode) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			entry.Name(), info.Size(), info.Mode().String(), info.ModTime().Format("2006-01-02 15:04:05"), boolToInt(info.IsDir()), url.PathEscape(entry.Name()), "/shared/"+url.PathEscape(entry.Name()), fileId); err != nil {
			log.Println("[x]注入文件信息失败:", err)
			return
		}
	}

	// 监听目录
	err = watcher.Add(watchDir)
	if err != nil {
		log.Println("[x]监听目录失败:", err)
		return
	}

	for {
		select {
		case event, ok := <-watcher.Events:
			if !ok {
				return
			}
			// 处理事件类型
			switch {
			case event.Op&fsnotify.Create == fsnotify.Create:
				log.Printf("创建文件: %s,%v", event.Name, event)
			case event.Op&fsnotify.Write == fsnotify.Write:
				log.Printf("修改文件: %s", event.Name)
			case event.Op&fsnotify.Remove == fsnotify.Remove:
				log.Printf("删除文件: %s", event.Name)
			case event.Op&fsnotify.Rename == fsnotify.Rename:
				log.Printf("重命名文件: %s", event.Name)
			}
		case err, ok := <-watcher.Errors:
			if !ok {
				return
			}
			log.Println("[x]监听错误:", err)
		}
	}
}
