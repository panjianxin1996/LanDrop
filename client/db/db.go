package db

import (
	"context"
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
	if _, err := db.Exec(`DROP TABLE IF EXISTS friendships;
		DROP TABLE IF EXISTS chat_records;
		DROP TABLE IF EXISTS settings;
		DROP TABLE IF EXISTS users;`); err != nil {
		return sdb, fmt.Errorf("删除表失败: %v", err)
	}
	// 初始化用户表结构
	if _, err := db.Exec(`CREATE TABLE IF NOT EXISTS users (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		avatar TEXT,
		name TEXT NOT NULL,
		nickName TEXT NOT NULL,
		pwd TEXT NOT NULL,
		role TEXT NOT NULL,
		ip TEXT NOT NULL,
		createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
	)`); err != nil {
		return sdb, fmt.Errorf("初始化用户表结构失败: %v", err)
	}
	// 默认添加超级管理员999账户
	db.Exec(`INSERT INTO users (id, name, nickName, pwd, role, ip, createdAt) VALUES (999 , "admin", "admin", "admin@123", "admin+", "127.0.0.1", ?)`, time.Now().Format("2006-01-02 15:04:05"))
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
		"toId" INTEGER NOT NULL,
		"fromId" INTEGER NOT NULL,
		"isRead" TEXT,
		"type" TEXT,
		"message" TEXT,
		"time" integer NOT NULL,
		CONSTRAINT "toId" FOREIGN KEY ("toId") REFERENCES "users" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
		CONSTRAINT "fromId" FOREIGN KEY ("fromId") REFERENCES "users" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
	)`); err != nil {
		return sdb, fmt.Errorf("初始化聊天记录表结构失败: %v", err)
	}
	// 初始化好友表结构
	if _, err := db.Exec(`CREATE TABLE IF NOT EXISTS friendships (
		"fId" INTEGER PRIMARY KEY AUTOINCREMENT,
		"userId" INTEGER NOT NULL,
		"friendId" INTEGER NOT NULL,
		"status" TEXT,
		"lastChatId" INTEGER,
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

func (s SqlliteDB) QueryListTx(tx *sql.Tx, queryStr string, args ...any) []map[string]any {
	var userList []map[string]any
	rows, err := tx.Query(queryStr, args...)
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

func (s SqlliteDB) ExecTx(tx *sql.Tx, queryStr string, args ...any) (sql.Result, error) {
	return tx.Exec(queryStr, args...)
}

// 事务处理数据库
func (s SqlliteDB) Transaction(opts *sql.TxOptions, fn func(*sql.Tx) error) error {
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second) // 设置事务60s超时
	defer cancel()                                                           // 确保释放资源
	tx, err := s.DB.BeginTx(ctx, opts)
	if err != nil {
		return fmt.Errorf("启动事务失败：%v", err)
	}
	// 使用命名返回值来捕获defer中的错误
	var txErr error
	defer func() {
		if p := recover(); p != nil {
			tx.Rollback() // 回滚事务并抛出错误
			txErr = fmt.Errorf("[-9999]出现严重错误%v", p)
		} else if txErr != nil {
			if rbErr := tx.Rollback(); rbErr != nil { // 如果函数返回错误，回滚事务
				txErr = fmt.Errorf("事务操作失败: %v, 事务回滚失败: %w", txErr, rbErr)
			}
		} else {
			txErr = tx.Commit() // 提交事务
		}
	}()
	// 执行事务操作
	txErr = fn(tx)
	return txErr
}
