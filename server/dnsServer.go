package server

import (
	"log"
	"net"

	"github.com/miekg/dns"
)

var dnsServer *dns.Server

func StartDNSServer() {
	// 创建DNS服务器实例
	dnsServer = &dns.Server{
		Addr: ":53", // 监听53端口(DNS标准端口)
		Net:  "udp", // 使用UDP协议
	}

	// 设置DNS处理函数
	dns.HandleFunc(".", func(w dns.ResponseWriter, r *dns.Msg) {
		msg := new(dns.Msg)
		msg.SetReply(r)

		// 获取查询的域名
		domain := r.Question[0].Name

		// 自定义域名解析 - 这里将landrop.go解析到127.0.0.1
		if domain == "landrop.go." {
			rr := &dns.A{
				Hdr: dns.RR_Header{
					Name:   domain,
					Rrtype: dns.TypeA,
					Class:  dns.ClassINET,
					Ttl:    300, // TTL时间(秒)
				},
				A: net.ParseIP("127.0.0.1"),
			}
			msg.Answer = append(msg.Answer, rr)
		} else {
			// 其他域名转发到8.8.8.8
			c := new(dns.Client)
			resp, _, err := c.Exchange(r, "8.8.8.8:53")
			if err != nil {
				log.Printf("DNS查询失败: %v", err)
				dns.HandleFailed(w, r)
				return
			}
			msg.Answer = resp.Answer
		}

		w.WriteMsg(msg)
	})

	// 启动DNS服务器
	log.Printf("启动DNS服务器，监听 %s\n", dnsServer.Addr)
	err := dnsServer.ListenAndServe()
	if err != nil {
		log.Fatalf("启动DNS服务器失败: %v\n", err)
	}
}

func StopDNSServer() {
	log.Println("停止DNS服务器")
	dnsServer.Shutdown()
}
