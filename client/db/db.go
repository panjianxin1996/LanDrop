package db

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
)

// 创建sqllite数据库
func InitDB(dbPath string) (*sql.DB, error) {
	// 检查目录是否存在，不存在则创建
	dir := filepath.Dir(dbPath)
	if _, err := os.Stat(dir); os.IsNotExist(err) {
		if err := os.MkdirAll(dir, 0755); err != nil {
			return nil, fmt.Errorf("创建目录失败: %v", err)
		}
	}
	// 打开（或创建）数据库
	db, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		return nil, fmt.Errorf("打开数据库失败: %v", err)
	}
	// 测试连接
	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("数据库连接测试失败: %v", err)
	}
	// 初始化表结构
	if _, err := db.Exec(`CREATE TABLE IF NOT EXISTS users (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		name TEXT NOT NULL,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`); err != nil {
		return nil, fmt.Errorf("初始化表结构失败: %v", err)
	}
	return db, nil
}
