package fsListen

import (
	"crypto/rand"
	"database/sql"
	"fmt"
	"log"
	"math/big"
	"net/url"
	"os"
	"path/filepath"

	"github.com/fsnotify/fsnotify"
)

func boolToInt(b bool) int {
	if b {
		return 1
	}
	return 0
}

/*
generateRandomCode 生成指定长度的随机码，并确保该随机码在数据库中是唯一的。
参数:

	length - 生成随机码的长度。
	db - 数据库连接。

返回值:

	生成的随机码字符串。
	错误，如果生成或数据库查询过程中发生错误。
*/
func generateRandomCode(length int, db *sql.DB) (string, error) {
	const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	code := make([]byte, length)
	for i := range code {
		n, err := rand.Int(rand.Reader, big.NewInt(int64(len(charset))))
		if err != nil {
			return "", err
		}
		code[i] = charset[n.Int64()]
	}
	// 检查数据库中是否已存在该code
	var count int
	for range 5 { // 最多尝试5次
		code := make([]byte, length)
		for j := range code {
			n, err := rand.Int(rand.Reader, big.NewInt(int64(len(charset))))
			if err != nil {
				return "", err
			}
			code[j] = charset[n.Int64()]
		}
		codeStr := string(code)
		// 检查数据库中是否存在该fileCode
		err := db.QueryRow("SELECT COUNT(*) FROM files WHERE fileCode = ?", codeStr).Scan(&count)
		if err != nil {
			return "", err
		}
		if count == 0 {
			return codeStr, nil
		}
	}
	return "", fmt.Errorf("存在code 重复，尝试五次还是失败")
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
	if _, err = db.Exec(`
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
		fileId, codeErr := generateRandomCode(6, db)
		if codeErr != nil {
			log.Println("生成唯一fileId失败:", err)
			return
		}
		if _, err = db.Exec(`INSERT INTO files (fileName, fileSize, fileMode, fileModTime, isDir,uriName, path, fileCode) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
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
				log.Printf("创建文件: %s", event.Name)
				info, osErr := os.Stat(event.Name)
				if osErr != nil {
					log.Println("获取文件信息失败:", osErr)
					break
				}
				fileName := info.Name()
				fileId, codeErr := generateRandomCode(6, db)
				if codeErr != nil {
					log.Println("生成唯一fileId失败:", codeErr)
					break
				}
				if _, err = db.Exec(`INSERT INTO files (fileName, fileSize, fileMode, fileModTime, isDir, uriName, path, fileCode) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
					fileName, info.Size(), info.Mode().String(), info.ModTime().String(), info.IsDir(), url.PathEscape(fileName), "/shared/"+url.PathEscape(fileName), fileId); err != nil {
					log.Println("[x]插入数据库失败:", err)
				}
			case event.Op&fsnotify.Write == fsnotify.Write:
				log.Printf("修改文件: %s", event.Name)
				info, osErr := os.Stat(event.Name)
				if osErr != nil {
					log.Println("[x]获取文件信息失败:", osErr)
					break
				}
				fileName := info.Name()
				if _, err = db.Exec(`UPDATE files SET fileSize = ?, fileModTime = ? WHERE fileName = ?`,
					info.Size(), info.ModTime().String(), fileName); err != nil {
					log.Println("[x]更新数据库失败:", err)
				}
			case event.Op&fsnotify.Remove == fsnotify.Remove:
				log.Printf("删除文件: %s", event.Name)
				fileName := filepath.Base(event.Name)
				if _, err = db.Exec(`DELETE FROM files WHERE fileName = ?`, fileName); err != nil {
					log.Println("[x]删除数据库记录失败:", err)
				}
			case event.Op&fsnotify.Rename == fsnotify.Rename:
				log.Printf("重命名文件: %s", event.Name)
				oldFileName := filepath.Base(event.Name)
				if _, err = db.Exec(`DELETE FROM files WHERE fileName = ?`, oldFileName); err != nil {
					log.Println("[x]删除旧文件名数据库记录失败:", err)
				}
			}
		case err, ok := <-watcher.Errors:
			if !ok {
				return
			}
			log.Println("[x]监听错误:", err)
		}
	}
}
