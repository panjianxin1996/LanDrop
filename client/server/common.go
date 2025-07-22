package server

import (
	"LanDrop/client/db"
	"embed"
	"encoding/base64"
	"errors"
	"fmt"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"path/filepath"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
)

type Router struct { // 路由
	app    *fiber.App
	assets embed.FS
	config Config
	Reply
	db      db.SqlliteDB
	userDir string
}
type FileInfo struct { // 文件参数
	ID       int    `json:"fileId"`
	Name     string `json:"fileName"`
	Size     int    `json:"fileSize"`
	Mode     string `json:"fileMode"`
	ModTime  string `json:"fileModTime"`
	IsDir    bool   `json:"isDir"`
	URIName  string `json:"uriName"`
	Path     string `json:"path"`
	FileCode string `json:"fileCode"`
}

type Reply struct { // 接口回复数据
	Code int    `json:"code"`
	Msg  string `json:"msg"`
	Data any    `json:"data"`
}

type UserToken struct {
	UserID               int64  `json:"userId"`
	Username             string `json:"userName"`
	Role                 string `json:"role"`
	jwt.RegisteredClaims        // 内嵌标准Claims（过期时间等）
}

var SecretKey = []byte("KNTWcTMPxMbGPhUZskWn")    // token 密钥
var XORSecretKey = []byte("xmn30241yv413y5b01vy") // token XOR加密密钥

// 辅助函数：生成安全的文件名
func generateFilename(original string) string {
	ext := filepath.Ext(original)
	// 微秒级别
	now := time.Now()
	base := now.Format("2006-01-02_15-04-05")
	micro := now.Nanosecond() / 1000
	return fmt.Sprintf("%v-%v_%s%s", base, micro, strings.TrimSuffix(original, ext), ext)
}

// XOR加密
func EncryptToken(token string) string {
	keyBytes := []byte(XORSecretKey)
	encrypted := make([]byte, len(token))
	for i := 0; i < len(token); i++ {
		encrypted[i] = token[i] ^ keyBytes[i%len(keyBytes)]
	}
	// 使用URL安全的Base64编码，避免特殊字符问题
	return base64.URLEncoding.EncodeToString(encrypted)
}

// DecryptToken 解密方法
func DecryptToken(encrypted string) (string, error) {
	keyBytes := []byte(XORSecretKey)
	// 解码Base64
	data, err := base64.URLEncoding.DecodeString(encrypted)
	if err != nil {
		return "", errors.New("invalid encrypted token format")
	}
	decrypted := make([]byte, len(data))
	for i := 0; i < len(data); i++ {
		decrypted[i] = data[i] ^ keyBytes[i%len(keyBytes)]
	}
	return string(decrypted), nil
}

// 创建XOR token
func CreateToken(role string, userId int64, userName string, expTime int) (string, error) {
	claims := UserToken{
		UserID:   userId,
		Username: userName,
		Role:     role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Duration(expTime) * time.Hour)), // 过期时间
			IssuedAt:  jwt.NewNumericDate(time.Now()),                                         // 签发时间
			Issuer:    "landrop_client",                                                       // 签发者
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString(SecretKey)
	if err != nil {
		return "", err
	}
	tokenString = EncryptToken(tokenString)
	return tokenString, nil
}

// 解析XOR token
func ParseToken(tokenString string) (*UserToken, error) {
	realTokenStr, err := DecryptToken(tokenString)
	if err != nil {
		return nil, err
	}
	token, err := jwt.ParseWithClaims(
		realTokenStr,
		&UserToken{},
		func(token *jwt.Token) (any, error) {
			return SecretKey, nil
		},
	)
	if claims, ok := token.Claims.(*UserToken); ok && token.Valid {
		return claims, nil
	} else {
		return nil, err
	}
}

// 代理服务器 将本地80端口映射到4321端口
func proxyServer() (*http.Server, error) {
	target, err := url.Parse("http://localhost:4321")
	if err != nil {
		return nil, err
	}
	proxy := httputil.NewSingleHostReverseProxy(target)
	// 创建http.Server实例，而非直接用ListenAndServe
	server := &http.Server{
		Addr:    ":80",
		Handler: proxy,
	}
	// 异步启动服务（不阻塞）
	go func() {
		log.Println("代理服务启动，监听 :80")
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("代理服务启动失败: %v", err)
		}
	}()
	return server, nil
}

// 检测slice中是否包含某个元素
func Contains(slice []string, target string) bool {
	for _, s := range slice {
		if s == target {
			return true
		}
	}
	return false
}
