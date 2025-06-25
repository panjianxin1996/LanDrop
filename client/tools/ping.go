package tools

import (
	"fmt"
	"time"

	proBing "github.com/prometheus-community/pro-bing"
)

func PingHost(pingId any, host string, count int, timeout time.Duration) (map[string]any, error) {
	pingContent := map[string]any{}
	pinger, err := proBing.NewPinger(host)
	if err != nil {
		return nil, fmt.Errorf("创建Pinger失败: %v", err)
	}
	pinger.Count = count
	pinger.Timeout = timeout
	pinger.SetPrivileged(true) // Windows 需要
	recv := []string{}
	pinger.OnRecv = func(pkt *proBing.Packet) {
		recv = append(recv, fmt.Sprintf("来自 %s 的回复: 延迟=%v 数据包大小=%d\n", pkt.IPAddr, pkt.Rtt, pkt.Nbytes))
	}
	result := []string{}
	pinger.OnFinish = func(stats *proBing.Statistics) {
		result = append(result, fmt.Sprintf("统计: 丢包率=%.2f%%, 平均延迟=%v\n", stats.PacketLoss, stats.AvgRtt))
	}
	pingContent["host"] = host
	pingContent["ip"] = pinger.IPAddr()
	pingContent["pingId"] = pingId
	pingContent["recv"] = recv
	pingContent["result"] = result
	err = pinger.Run()
	if err != nil {
		return nil, fmt.Errorf("Ping执行失败: %v", err)
	}
	return pingContent, nil
}
