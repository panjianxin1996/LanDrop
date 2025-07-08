package server

import (
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

	return tokenString, nil
}

func ParseToken(tokenString string) (*tokenClaims, error) {
	token, err := jwt.ParseWithClaims(
		tokenString,
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
