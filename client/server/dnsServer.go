package server

import (
	"log"
	"net"
	"sync/atomic"

	"github.com/miekg/dns"
)

var (
	dnsServer   *dns.Server
	AppIpv4Addr atomic.Value
	AppIpv6Addr atomic.Value
)

func SetAppIPv4(ip string) {
	AppIpv4Addr.Store(ip)
}

func GetAppIPv4() string {
	val, _ := AppIpv4Addr.Load().(string)
	return val
}

func SetAppIPv6(ip string) {
	AppIpv6Addr.Store(ip)
}

func GetAppIPv6() string {
	val, _ := AppIpv6Addr.Load().(string)
	return val
}

func StartDNSServer() {
	dnsServer = &dns.Server{
		Addr: ":53",
		Net:  "udp",
	}

	dns.HandleFunc(".", func(w dns.ResponseWriter, r *dns.Msg) {
		msg := new(dns.Msg)
		msg.SetReply(r)
		msg.Authoritative = true
		currentIPv4 := GetAppIPv4() // 通过线程安全方法获取
		currentIPv6 := GetAppIPv6()
		domain := r.Question[0].Name // 请求的域名
		qtype := r.Question[0].Qtype // ip类型 v4 v6
		if domain == "landrop.go." {
			// IPv4 (A记录)
			if qtype == dns.TypeA {
				appIpv4 := "127.0.0.1"
				if currentIPv4 != "" {
					appIpv4 = currentIPv4
				}
				msg.Answer = append(msg.Answer, &dns.A{
					Hdr: dns.RR_Header{
						Name:   domain,
						Rrtype: dns.TypeA,
						Class:  dns.ClassINET,
						Ttl:    300,
					},
					A: net.ParseIP(appIpv4),
				})
			}

			// IPv6 (AAAA记录)
			if qtype == dns.TypeAAAA && currentIPv6 != "" {
				msg.Answer = append(msg.Answer, &dns.AAAA{
					Hdr: dns.RR_Header{
						Name:   domain,
						Rrtype: dns.TypeAAAA,
						Class:  dns.ClassINET,
						Ttl:    300,
					},
					AAAA: net.ParseIP(currentIPv6),
				})
			}
		} else {
			// 其他域名转发
			c := new(dns.Client)
			resp, _, err := c.Exchange(r, "8.8.8.8:53")
			if err != nil {
				dns.HandleFailed(w, r)
				return
			}
			msg.Answer = resp.Answer
		}

		w.WriteMsg(msg)
	})

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
