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
		log.Println("============================FSWatcher", err)
		return
	}
	defer watcher.Close()

	// 读取目录进行映射到数据库
	db.Exec(`DROP TABLE IF EXISTS files;`)
	db.Exec(`
		CREATE TABLE IF NOT EXISTS files (
			fileId INTEGER PRIMARY KEY AUTOINCREMENT,
			fileName TEXT NOT NULL,
			fileSize INTEGER NOT NULL,
			fileMode  TEXT NOT NULL,
			fileModTime TEXT NOT NULL,
			IsDir   INTEGER NOT NULL,
			URIName TEXT NOT NULL,
			Path  TEXT NOT NULL,
			FileId TEXT NOT NULL,
		)
	`)
	entries, err := os.ReadDir(watchDir)
	for _, entry := range entries {
		info, _ := entry.Info()
		fileId := generateRandomCode(8)
		db.Exec(`INSERT INTO files (fileName, fileSize, fileMode, fileModTime, IsDir, URIName, Path, FileId) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			entry.Name(), info.Size(), info.Mode().String(), info.ModTime().String(), info.IsDir(), url.PathEscape(entry.Name()), "/shared/"+url.PathEscape(entry.Name()), fileId)
	}

	// 监听目录
	err = watcher.Add(watchDir)
	if err != nil {
		log.Println("============================FSWatcher", err)
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
				log.Printf("创建文件: %s", event.Name)
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
			log.Println("错误:", err)
		}
	}
}
