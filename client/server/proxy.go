package server

import (
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
)

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
