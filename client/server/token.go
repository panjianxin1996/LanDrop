package server

import (
	"encoding/base64"
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

type tokenClaims struct {
	UserID               int64  `json:"userId"`
	Username             string `json:"userName"`
	Role                 string `json:"role"`
	jwt.RegisteredClaims        // 内嵌标准Claims（过期时间等）
}

var SecretKey = []byte("KNTWcTMPxMbGPhUZskWn")

var XORSecretKey = []byte("xmn30241yv413y5b01vy")

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
func CreateToken(role string, userId int64, userName string, expTime int) (string, error) {
	claims := tokenClaims{
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

func ParseToken(tokenString string) (*tokenClaims, error) {
	realTokenStr, err := DecryptToken(tokenString)
	if err != nil {
		return nil, err
	}
	token, err := jwt.ParseWithClaims(
		realTokenStr,
		&tokenClaims{},
		func(token *jwt.Token) (any, error) {
			return SecretKey, nil
		},
	)

	if claims, ok := token.Claims.(*tokenClaims); ok && token.Valid {
		return claims, nil
	} else {
		return nil, err
	}
}
