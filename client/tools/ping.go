package tools

import (
	"fmt"
	"net"
	"sync"
	"time"

	proBing "github.com/prometheus-community/pro-bing"
)

type ScanNetworkData struct {
	StartRange net.IP              `json:"startRange"`
	EndRange   net.IP              `json:"endRange"`
	Devices    []map[string]string `json:"devices"`
	TotalCount uint32              `json:"totalCount"`
	Error      error               `json:"error"`
}

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
		recv = append(recv, fmt.Sprintf("%s回复:延迟=%v,数据包大小=%d", pkt.IPAddr, pkt.Rtt, pkt.Nbytes))
	}
	result := []string{}
	pinger.OnFinish = func(stats *proBing.Statistics) {
		result = append(result, fmt.Sprintf("统计:丢包率=%.2f%%,平均延迟=%v", stats.PacketLoss, stats.AvgRtt))
	}
	err = pinger.Run()
	if err != nil {
		return nil, fmt.Errorf("Ping执行失败: %v", err)
	}
	pingContent["host"] = host
	pingContent["ip"] = pinger.IPAddr()
	pingContent["pingId"] = pingId
	pingContent["recv"] = recv
	pingContent["result"] = result
	return pingContent, nil
}

func ScanNetWork(targetIP string, subnetMask string) (ScanNetworkData, error) {
	// 解析IP和掩码
	ip := net.ParseIP(targetIP).To4()
	if ip == nil {
		return ScanNetworkData{}, fmt.Errorf("无效的IPv4地址")
	}
	mask := net.IPMask(net.ParseIP(subnetMask).To4())
	if mask == nil {
		return ScanNetworkData{}, fmt.Errorf("无效的子网掩码")
	}
	// 计算网络地址（网段）
	network := &net.IPNet{
		IP:   ip.Mask(mask),
		Mask: mask,
	}
	// 计算该网段下的IP范围
	firstIP, lastIP := calculateIPRange(network)
	scanData := scanNetwork(firstIP, lastIP)
	scanData.StartRange = firstIP
	scanData.EndRange = firstIP
	// 扫描网络中的设备
	return scanData, scanData.Error
}

// 计算一个网段的首尾IP
func calculateIPRange(network *net.IPNet) (net.IP, net.IP) {
	firstIP := make(net.IP, len(network.IP))
	copy(firstIP, network.IP)
	firstIP[len(firstIP)-1]++ // 第一个可用IP（跳过网络地址）
	lastIP := make(net.IP, len(network.IP))
	for i := 0; i < len(lastIP); i++ {
		lastIP[i] = network.IP[i] | ^network.Mask[i]
	}
	lastIP[len(lastIP)-1]-- // 最后一个可用IP（跳过广播地址）
	return firstIP, lastIP
}

func scanNetwork(startIP, endIP net.IP) ScanNetworkData {
	var wg sync.WaitGroup
	activeHosts := make(chan string, 254)
	scanData := ScanNetworkData{}
	totalIPs := ipToInt(endIP) - ipToInt(startIP) + 1
	if totalIPs > 500 {
		scanData.Devices = []map[string]string{}
		scanData.TotalCount = totalIPs
		scanData.Error = fmt.Errorf("扫描范围过大，请选择较小的范围")
		return scanData
	}
	// 扫描范围内的所有IP
	currentIP := make(net.IP, len(startIP))
	copy(currentIP, startIP)
	for i := 0; i < int(totalIPs); i++ {
		wg.Add(1)
		go func(ip net.IP) {
			defer wg.Done()
			pinger, err := proBing.NewPinger(ip.String())
			if err != nil {
				return
			}
			pinger.Count = 2
			pinger.Timeout = time.Second * 2
			pinger.SetPrivileged(true)
			err = pinger.Run()
			if err == nil && pinger.Statistics().PacketsRecv > 0 {
				activeHosts <- ip.String()
			}
		}(makeCopy(currentIP))
		incrementIP(currentIP)
	}
	go func() {
		wg.Wait()
		close(activeHosts)
	}()
	activeDevices := []map[string]string{}
	for host := range activeHosts {
		names, err := net.LookupAddr(host)
		var hostname string
		if err == nil && len(names) > 0 {
			hostname = names[0]
		} else {
			hostname = "unknown"
		}
		activeDevices = append(activeDevices, map[string]string{
			"ip":       host,
			"hostname": hostname,
		})
	}
	scanData.Devices = activeDevices
	scanData.TotalCount = totalIPs
	scanData.Error = nil
	return scanData
}

// 辅助函数：IP地址转整数
func ipToInt(ip net.IP) uint32 {
	ip = ip.To4()
	return uint32(ip[0])<<24 | uint32(ip[1])<<16 | uint32(ip[2])<<8 | uint32(ip[3])
}

// 辅助函数：递增IP
func incrementIP(ip net.IP) {
	for i := len(ip) - 1; i >= 0; i-- {
		ip[i]++
		if ip[i] > 0 {
			break
		}
	}
}

// 辅助函数：深拷贝IP
func makeCopy(ip net.IP) net.IP {
	newIP := make(net.IP, len(ip))
	copy(newIP, ip)
	return newIP
}
