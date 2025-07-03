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
	// 初始化用户表结构
	if _, err := db.Exec(`CREATE TABLE IF NOT EXISTS users (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		name TEXT NOT NULL,
		pwd TEXT NOT NULL,
		role TEXT NOT NULL,
		ip TEXT NOT NULL,
		createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
	)`); err != nil {
		return nil, fmt.Errorf("初始化用户表结构失败: %v", err)
	}
	// 初始化客户端设置表结构
	if _, err := db.Exec(`CREATE TABLE IF NOT EXISTS settings (
		"sId" INTEGER PRIMARY KEY AUTOINCREMENT,
		"name" TEXT NOT NULL,
		"appName" TEXT,
		"port" integer NOT NULL,
		"tokenExpiryTime" integer NOT NULL,
		"sharedDir" TEXT,
		"version" TEXT,
		"createdAt" TEXT,
		"modifiedAt" TEXT,
		CONSTRAINT "name unique" UNIQUE ("name" ASC)
	)`); err != nil {
		return nil, fmt.Errorf("初始化客户端设置表结构失败: %v", err)
	}
	// 初始化聊天记录表结构
	if _, err := db.Exec(`CREATE TABLE IF NOT EXISTS chat_records (
		"cId" INTEGER PRIMARY KEY AUTOINCREMENT,
		"to" TEXT NOT NULL,
		"from" TEXT NOT NULL,
		"isRead" TEXT,
		"type" TEXT,
		"message" TEXT,
		"time" integer NOT NULL
	)`); err != nil {
		return nil, fmt.Errorf("初始化聊天记录表结构失败: %v", err)
	}
	// 初始化好友表结构
	if _, err := db.Exec(`CREATE TABLE IF NOT EXISTS friendships (
		"fId" INTEGER PRIMARY KEY AUTOINCREMENT,
		"userId" INTEGER NOT NULL,
		"friendId" INTEGER NOT NULL,
		"status" TEXT,
		"lastMessage" TEXT,
		"createTime" TEXT,
		CONSTRAINT "userId" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
		CONSTRAINT "friendId" FOREIGN KEY ("friendId") REFERENCES "users" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
	);
	CREATE INDEX IF NOT EXISTS idx_friendships_status ON friendships(status);`); err != nil {
		return nil, fmt.Errorf("初始化好友表结构失败: %v", err)
	}
	return db, nil
}
