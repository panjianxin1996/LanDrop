package tools

import (
	"fmt"
	"net"
	"os/exec"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"time"

	proBing "github.com/prometheus-community/pro-bing"
)

type DeviceInfo struct {
	IP       string `json:"ip"`
	Hostname string `json:"hostname"`
	MAC      string `json:"mac"`
	Vendor   string `json:"vendor"`
	Model    string `json:"model"`
	OS       string `json:"os"`
}

type ScanNetworkData struct {
	StartRange string       `json:"start_range"`
	EndRange   string       `json:"end_range"`
	Devices    []DeviceInfo `json:"devices"`
	TotalCount uint32       `json:"total_count"`
	Error      error        `json:"error,omitempty"`
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
		return nil, fmt.Errorf("ping执行失败: %v", err)
	}
	pingContent["host"] = host
	pingContent["ip"] = pinger.IPAddr()
	pingContent["pingId"] = pingId
	pingContent["recv"] = recv
	pingContent["result"] = result
	return pingContent, nil
}

// MAC厂商数据库（简化版）
var vendorMap = map[string]string{
	"00:0C:29": "VMware",
	"00:50:56": "VMware",
	"00:1C:42": "Parallels",
	"08:00:27": "VirtualBox",
	"00:05:69": "VMware",
	"00:16:3E": "Xen",
	"B8:27:EB": "Raspberry Pi",
	"DC:A6:32": "Raspberry Pi",
	"00:1A:11": "Google",
	"F4:F5:E8": "Google Nest",
	"00:17:88": "Philips Hue",
	"EC:1A:59": "Belkin",
	"00:1E:58": "Sony",
	"00:1D:7E": "Sony",
	"00:12:17": "Sony",
	"00:04:5B": "Verifone",
	"00:14:A5": "Gemtek",
	"00:18:56": "Hon Hai (Foxconn)",
	"00:19:7D": "Hon Hai (Foxconn)",
	"00:1C:B3": "Apple",
	"00:1D:4F": "Apple",
	"00:1E:C2": "Apple",
	"00:21:E9": "Apple",
	"00:23:6C": "Apple",
	"00:25:00": "Apple",
	"00:26:BB": "Apple",
	"02:26:BB": "Apple",
	"24:A2:E1": "Apple",
	"34:12:98": "Apple",
	"3C:07:54": "Apple",
	"3C:15:C2": "Apple",
	"40:6C:8F": "Apple",
	"40:A6:D9": "Apple",
	"44:FB:42": "Apple",
	"50:EA:D6": "Apple",
	"60:FB:42": "Apple",
	"70:DE:E2": "Apple",
	"78:6C:1C": "Apple",
	"84:29:14": "Apple",
	"8C:7B:9D": "Apple",
	"90:B2:1F": "Apple",
	"98:03:D8": "Apple",
	"A4:5E:60": "Apple",
	"A8:BB:CF": "Apple",
	"B8:8D:12": "Apple",
	"CC:08:E0": "Apple",
	"D8:30:62": "Apple",
	"E0:B9:BA": "Apple",
	"E0:F8:47": "Apple",
	"F0:DB:E2": "Apple",
	"F8:1E:DF": "Apple",
	"00:1A:4B": "富士通",
	"00:1B:21": "Intel",
	"00:1C:C4": "Hewlett Packard",
	"00:1E:4F": "Dell",
	"00:21:9B": "Samsung",
	"00:22:64": "Samsung",
	"00:23:7D": "HTC",
	"00:24:81": "Samsung",
	"00:26:5E": "Hon Hai (Foxconn)",
	"00:27:0E": "Intel",
	"00:27:22": "Ubiquiti Networks",
	"00:50:C2": "IEEE Registration Authority",
	"00:A0:C6": "Qualcomm",
	"00:E0:4C": "Realtek",
	"08:00:20": "Sun Microsystems",
	"14:10:9F": "Apple",
	"18:AF:61": "Apple",
	"20:73:55": "ARRIS",
	"24:FD:52": "Liteon",
	"28:CF:E9": "Apple",
	"2C:F0:EE": "Apple",
	"30:9C:23": "Micro-Star INTL CO.",
	"38:C9:86": "Apple",
	"40:30:04": "Apple",
	"40:9F:38": "AzureWave",
	"44:37:E6": "Hon Hai (Foxconn)",
	"4C:32:75": "Apple",
	"4C:7C:5F": "Apple",
	"54:60:09": "Google",
	"58:1F:AA": "Apple",
	"60:6D:C7": "Hon Hai (Foxconn)",
	"64:70:33": "Apple",
	"6C:40:08": "Apple",
	"6C:72:E7": "Apple",
	"70:11:24": "Apple",
	"70:56:81": "Apple",
	"74:E5:0B": "Intel",
	"78:CA:83": "Apple",
	"7C:6D:62": "Apple",
	"7C:C5:37": "Apple",
	"80:00:10": "AT&T",
	"80:E8:2C": "Hewlett Packard",
	"84:38:35": "Apple",
	"88:53:2E": "Intel",
	"8C:85:90": "Apple",
	"94:94:26": "Apple",
	"9C:5C:8E": "ASUSTek",
	"A4:34:D9": "Intel",
	"A4:C3:61": "Apple",
	"A8:66:7F": "Apple",
	"AC:7F:3E": "Apple",
	"AC:BC:32": "Apple",
	"B0:34:95": "Apple",
	"B4:9D:0B": "Samsung",
	"C0:3E:0F": "BSkyB",
	"C4:2C:03": "Apple",
	"C8:3C:85": "Apple",
	"CC:25:EF": "Apple",
	"D0:23:DB": "Apple",
	"D4:9A:20": "Apple",
	"D8:A2:5E": "Apple",
	"D8:CF:9C": "Apple",
	"E0:AC:F1": "Cisco",
	"E4:CE:8F": "Apple",
	"E8:B2:AC": "Apple",
	"EC:35:86": "Apple",
	"F0:18:98": "Apple",
	"F4:0F:24": "Apple",
	"F8:63:3F": "Intel",
	"FC:FC:48": "Apple",
}

func ScanNetWork(targetIP string, subnetMask string) (ScanNetworkData, error) {
	ip := net.ParseIP(targetIP).To4()
	if ip == nil {
		return ScanNetworkData{}, fmt.Errorf("无效的IPv4地址")
	}

	var mask net.IPMask
	if strings.HasPrefix(subnetMask, "/") {
		cidr, err := strconv.Atoi(subnetMask[1:])
		if err != nil || cidr < 0 || cidr > 32 {
			return ScanNetworkData{}, fmt.Errorf("无效的CIDR格式")
		}
		mask = net.CIDRMask(cidr, 32)
	} else {
		maskIP := net.ParseIP(subnetMask).To4()
		if maskIP == nil {
			return ScanNetworkData{}, fmt.Errorf("无效的子网掩码")
		}
		mask = net.IPMask(maskIP)
	}

	network := &net.IPNet{
		IP:   ip.Mask(mask),
		Mask: mask,
	}

	firstIP, lastIP := calculateIPRange(network)

	totalIPs := ipToInt(lastIP) - ipToInt(firstIP) + 1
	if totalIPs > 1000 {
		return ScanNetworkData{
			StartRange: firstIP.String(),
			EndRange:   lastIP.String(),
			Devices:    []DeviceInfo{},
			TotalCount: totalIPs,
			Error:      fmt.Errorf("扫描范围过大，请选择较小的范围"),
		}, nil
	}

	scanData := scanNetwork(firstIP, lastIP)
	scanData.StartRange = firstIP.String()
	scanData.EndRange = lastIP.String()
	scanData.TotalCount = totalIPs

	return scanData, nil
}

func calculateIPRange(network *net.IPNet) (net.IP, net.IP) {
	firstIP := make(net.IP, len(network.IP))
	copy(firstIP, network.IP)
	firstIP[len(firstIP)-1]++
	lastIP := make(net.IP, len(network.IP))
	for i := 0; i < len(lastIP); i++ {
		lastIP[i] = network.IP[i] | ^network.Mask[i]
	}
	lastIP[len(lastIP)-1]--
	return firstIP, lastIP
}

func scanNetwork(startIP, endIP net.IP) ScanNetworkData {
	var wg sync.WaitGroup
	deviceChan := make(chan DeviceInfo, 254)
	scanData := ScanNetworkData{}
	totalIPs := ipToInt(endIP) - ipToInt(startIP) + 1
	semaphore := make(chan struct{}, 30)
	currentIP := make(net.IP, len(startIP))
	copy(currentIP, startIP)
	for i := 0; i < int(totalIPs); i++ {
		semaphore <- struct{}{}
		wg.Add(1)
		go func(ip net.IP) {
			defer wg.Done()
			defer func() { <-semaphore }()

			device := scanHost(ip)
			if device.IP != "" {
				deviceChan <- device
			}
		}(makeCopy(currentIP))

		incrementIP(currentIP)
	}
	go func() {
		wg.Wait()
		close(deviceChan)
	}()
	activeDevices := []DeviceInfo{}
	for device := range deviceChan {
		activeDevices = append(activeDevices, device)
	}
	scanData.Devices = activeDevices
	return scanData
}

// 跨平台获取MAC地址的主要函数
func getMACAddress(ip string) string {
	// 首先确保ARP表中有该IP的条目
	pingIP(ip)
	// 获取ARP表
	arpTable := getARPTable()
	// 在ARP表中查找对应IP的MAC地址
	if mac, exists := arpTable[ip]; exists && mac != "" {
		return formatMAC(mac)
	}
	return ""
}

// 跨平台获取ARP表
func getARPTable() map[string]string {
	arpTable := make(map[string]string)
	var cmd *exec.Cmd
	if runtime.GOOS == "windows" {
		cmd = exec.Command("C:\\Windows\\System32\\ARP.EXE", "-a")
	} else {
		cmd = exec.Command("arp", "-n")
	}
	output, err := cmd.Output()
	if err != nil {
		return arpTable
	}
	lines := strings.Split(string(output), "\n")
	// Windows格式解析
	if runtime.GOOS == "windows" {
		return parseWindowsARPTable(lines)
	} else {
		// Unix/Linux格式解析
		return parseUnixARPTable(lines)
	}
}

func parseWindowsARPTable(lines []string) map[string]string {
	arpTable := make(map[string]string)
	for _, line := range lines {
		// Windows ARP表格式:
		// 192.168.1.1            00-11-22-33-44-55     动态
		// 192.168.1.100          00-11-22-33-44-55     静态
		line = strings.TrimSpace(line)
		if line == "" || strings.Contains(line, "Internet") || strings.Contains(line, "接口") {
			continue
		}
		fields := strings.Fields(line)
		if len(fields) >= 2 {
			ip := fields[0]
			mac := fields[1]

			// 验证IP地址格式
			if net.ParseIP(ip) != nil && mac != "ff-ff-ff-ff-ff-ff" && mac != "(incomplete)" {
				arpTable[ip] = mac
			}
		}
	}
	return arpTable
}

func parseUnixARPTable(lines []string) map[string]string {
	arpTable := make(map[string]string)
	for _, line := range lines {
		// Unix/Linux ARP表格式:
		// ? (192.168.1.1) at 00:11:22:33:44:55 [ether] on eth0
		// 192.168.1.1 ether 00:11:22:33:44:55 C eth0
		line = strings.TrimSpace(line)
		if line == "" || strings.Contains(line, "Address") {
			continue
		}
		fields := strings.Fields(line)
		if len(fields) >= 3 {
			var ip, mac string

			// 处理不同的格式
			if fields[0] == "?" && len(fields) >= 4 {
				// ? (192.168.1.1) at 00:11:22:33:44:55
				ip = strings.Trim(fields[1], "()")
				mac = fields[3]
			} else if len(fields) >= 3 {
				// 192.168.1.1 ether 00:11:22:33:44:55
				ip = fields[0]
				mac = fields[2]
			}

			// 验证IP和MAC地址
			if net.ParseIP(ip) != nil && mac != "ff:ff:ff:ff:ff:ff" && mac != "(incomplete)" {
				arpTable[ip] = mac
			}
		}
	}
	return arpTable
}

// ping IP以确保ARP表更新
func pingIP(ip string) {
	var cmd *exec.Cmd
	if runtime.GOOS == "windows" {
		cmd = exec.Command("ping", "-n", "1", "-w", "1000", ip)
	} else {
		cmd = exec.Command("ping", "-c", "1", "-W", "1", ip)
	}
	cmd.Run()
}

// 格式化MAC地址
func formatMAC(mac string) string {
	// 统一格式为 00:11:22:33:44:55
	mac = strings.ReplaceAll(mac, "-", ":")
	mac = strings.ToUpper(mac)
	// 确保每个部分都是两位
	parts := strings.Split(mac, ":")
	if len(parts) != 6 {
		return ""
	}
	for i, part := range parts {
		if len(part) == 1 {
			parts[i] = "0" + part
		} else if len(part) != 2 {
			return ""
		}
	}
	result := strings.Join(parts, ":")
	// 基本验证
	validMAC := true
	for _, part := range parts {
		for _, char := range part {
			if !((char >= '0' && char <= '9') || (char >= 'A' && char <= 'F')) {
				validMAC = false
				break
			}
		}
		if !validMAC {
			break
		}
	}
	if validMAC && result != "00:00:00:00:00:00" && result != "FF:FF:FF:FF:FF:FF" {
		return result
	}
	return ""
}

func scanHost(ip net.IP) DeviceInfo {
	device := DeviceInfo{
		IP: ip.String(),
	}
	// ICMP ping检测
	if !pingHost(ip.String()) {
		return DeviceInfo{} // 主机不在线
	}
	// 获取主机名
	device.Hostname = getHostname(ip.String())
	// 获取MAC地址
	mac := getMACAddress(ip.String())
	if mac != "" {
		device.MAC = mac
		device.Vendor = getVendorFromMAC(mac)
	}
	// 获取更多设备信息
	device.Model = detectDeviceModel(ip.String())
	device.OS = detectOS(ip.String())
	return device
}

func pingHost(ip string) bool {
	pinger, err := proBing.NewPinger(ip)
	if err != nil {
		return false
	}
	pinger.Count = 2
	pinger.Timeout = time.Second * 3
	if runtime.GOOS == "windows" {
		pinger.SetPrivileged(true)
	}
	err = pinger.Run()
	if err != nil {
		return false
	}
	stats := pinger.Statistics()
	return stats.PacketsRecv > 0
}

func getHostname(ip string) string {
	names, err := net.LookupAddr(ip)
	if err == nil && len(names) > 0 {
		hostname := strings.TrimSuffix(names[0], ".")
		return hostname
	}
	return "unknown"
}

func getVendorFromMAC(mac string) string {
	if len(mac) < 8 {
		return "Unknown"
	}
	oui := strings.ReplaceAll(mac[:8], ":", "")
	for prefix, vendor := range vendorMap {
		prefixClean := strings.ReplaceAll(prefix, ":", "")
		if strings.HasPrefix(oui, prefixClean) {
			return vendor
		}
	}
	return "Unknown Vendor"
}

func detectDeviceModel(ip string) string {
	openPorts := portScan(ip, []int{22, 23, 80, 443, 53, 139, 445, 3389})
	switch {
	case contains(openPorts, 3389):
		return "Windows PC"
	case contains(openPorts, 22) && (contains(openPorts, 80) || contains(openPorts, 443)):
		return "Linux Server"
	case contains(openPorts, 22):
		return "Linux/Unix Device"
	case contains(openPorts, 80) || contains(openPorts, 443):
		if contains(openPorts, 53) {
			return "Router/Gateway"
		}
		return "Web Server/Device"
	case contains(openPorts, 53):
		return "DNS Server"
	case contains(openPorts, 139) || contains(openPorts, 445):
		return "Windows Device"
	case contains(openPorts, 23):
		return "Network Equipment"
	default:
		return "Generic Device"
	}
}

func portScan(ip string, ports []int) []int {
	var openPorts []int
	var wg sync.WaitGroup
	resultChan := make(chan int, len(ports))
	for _, port := range ports {
		wg.Add(1)
		go func(p int) {
			defer wg.Done()
			conn, err := net.DialTimeout("tcp", fmt.Sprintf("%s:%d", ip, p), time.Second*1)
			if err == nil {
				conn.Close()
				resultChan <- p
			}
		}(port)
	}
	go func() {
		wg.Wait()
		close(resultChan)
	}()
	for port := range resultChan {
		openPorts = append(openPorts, port)
	}
	return openPorts
}

func detectOS(ip string) string {
	openPorts := portScan(ip, []int{22, 23, 80, 443, 53, 139, 445, 3389, 161})
	switch {
	case contains(openPorts, 3389):
		return "Windows"
	case contains(openPorts, 161):
		return "Network Device (SNMP)"
	case contains(openPorts, 22) && contains(openPorts, 80):
		return "Linux/Unix Server"
	case contains(openPorts, 22):
		return "Linux/Unix"
	case contains(openPorts, 139) || contains(openPorts, 445):
		return "Windows"
	case contains(openPorts, 80) || contains(openPorts, 443):
		return "Web Server OS"
	default:
		return "Unknown OS"
	}
}

func contains(slice []int, item int) bool {
	for _, v := range slice {
		if v == item {
			return true
		}
	}
	return false
}

func ipToInt(ip net.IP) uint32 {
	ip = ip.To4()
	return uint32(ip[0])<<24 | uint32(ip[1])<<16 | uint32(ip[2])<<8 | uint32(ip[3])
}

func incrementIP(ip net.IP) {
	for i := len(ip) - 1; i >= 0; i-- {
		ip[i]++
		if ip[i] > 0 {
			break
		}
	}
}

func makeCopy(ip net.IP) net.IP {
	newIP := make(net.IP, len(ip))
	copy(newIP, ip)
	return newIP
}
