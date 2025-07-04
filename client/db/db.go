package db

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"time"
)

type SqlliteDB struct {
	DB *sql.DB
}

// 创建sqllite数据库
func InitDB(dbPath string) (SqlliteDB, error) {
	sdb := SqlliteDB{
		DB: nil,
	}
	// 检查目录是否存在，不存在则创建
	dir := filepath.Dir(dbPath)
	if _, err := os.Stat(dir); os.IsNotExist(err) {
		if err := os.MkdirAll(dir, 0755); err != nil {
			return sdb, fmt.Errorf("创建目录失败: %v", err)
		}
	}
	// 打开（或创建）数据库
	db, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		return sdb, fmt.Errorf("打开数据库失败: %v", err)
	}
	// 测试连接
	if err := db.Ping(); err != nil {
		return sdb, fmt.Errorf("数据库连接测试失败: %v", err)
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
		return sdb, fmt.Errorf("初始化用户表结构失败: %v", err)
	}
	// 默认添加超级管理员999账户
	db.Exec(`INSERT INTO users (id, name, pwd, role, ip, createdAt) VALUES (999 , "admin", "admin@123", "admin+", "127.0.0.1", ?)`, time.Now().Format("2006-01-02 15:04:05"))
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
		return sdb, fmt.Errorf("初始化客户端设置表结构失败: %v", err)
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
		return sdb, fmt.Errorf("初始化聊天记录表结构失败: %v", err)
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
		return sdb, fmt.Errorf("初始化好友表结构失败: %v", err)
	}
	sdb.DB = db
	return sdb, nil
}

func (s SqlliteDB) QueryList(queryStr string, args ...any) []map[string]any {
	var userList []map[string]any
	rows, err := s.DB.Query(queryStr, args...)
	if err != nil {
		return userList
	}
	columns, _ := rows.Columns()
	values := make([]any, len(columns))
	for i := range values {
		var v any
		values[i] = &v
	}

	for rows.Next() {
		if err := rows.Scan(values...); err != nil {
			continue
		}
		row := make(map[string]any)
		for i, col := range columns {
			row[col] = *(values[i].(*any))
		}
		userList = append(userList, row)
	}
	return userList
}

func (s SqlliteDB) Exec(queryStr string, args ...any) (sql.Result, error) {
	return s.DB.Exec(queryStr, args...)
}
