import { useState, useCallback, useMemo } from 'react';
import { ToolsScanNetwork } from "@clientSDK/App"
import { Button } from '@/components/ui/button'
import { MonitorOff, Monitor, Server, Computer } from "lucide-react"
import { useStore } from '@/store/appStore';
interface Device {
    ip: string;
    hostname: string;
    mac?: string;
    vendor?: string;
    os?: string;
    model?: string;
}

interface ScanResult {
    startRange: string;
    endRange: string;
    devices: Device[];
    totalCount: number;
    error?: string;
}

const NetworkScanner = () => {
    const ipv4Address = useStore(state => state.ipv4Address);
    const [scanResult, setScanResult] = useState<ScanResult | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [ipAddress, setIpAddress] = useState(ipv4Address);
    const [subnetMask, setSubnetMask] = useState('255.255.255.0');
    const [isValid, setIsValid] = useState(true);

    // 验证IP和子网掩码格式
    const validateInputs = useCallback(() => {
        const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
        const maskRegex = /^(\d{1,3}\.){3}\d{1,3}$|^\/\d{1,2}$/;

        // 验证IP地址每个段是否在0-255范围内
        const isValidIp = ipRegex.test(ipAddress) &&
            ipAddress.split('.').every(part => parseInt(part, 10) <= 255);

        // 验证子网掩码
        const isValidMask = maskRegex.test(subnetMask) && (
            subnetMask.startsWith('/') ?
                parseInt(subnetMask.slice(1), 10) <= 32 :
                subnetMask.split('.').every(part => parseInt(part, 10) <= 255)
        );

        const isValidFormat = isValidIp && isValidMask;
        setIsValid(isValidFormat);
        return isValidFormat;
    }, [ipAddress, subnetMask]);

    // 扫描网络
    const handleScan = useCallback(() => {
        if (!validateInputs()) return;

        setIsLoading(true);
        setProgress(0);
        setScanResult(null);

        // 进度条模拟
        const progressInterval = setInterval(() => {
            setProgress(prev => {
                const newProgress = prev + 5;
                if (newProgress >= 95) {
                    clearInterval(progressInterval);
                    return 95;
                }
                return newProgress;
            });
        }, 500);

        // 执行扫描
        ToolsScanNetwork(ipAddress, subnetMask)
            .then((res: any) => {
                console.log(res, "res")
                setScanResult(res);
                setProgress(100);
            })
            .catch(error => {
                setScanResult({
                    startRange: ipAddress,
                    endRange: ipAddress,
                    devices: [],
                    totalCount: 0,
                    error: error.message || '扫描失败'
                });
            })
            .finally(() => {
                clearInterval(progressInterval);
                setIsLoading(false);
            });
    }, [ipAddress, subnetMask, validateInputs]);

    // 计算设备在多圈圆弧上的位置
    const getDevicePosition = useCallback((index: number, total: number) => {
        // 计算应该放在第几圈 (0: 内圈, 1: 中圈, 2: 外圈)
        const circleIndex = Math.min(2, Math.floor(index / Math.max(1, Math.ceil(total / 3))));

        // 每圈的半径
        const circleRadii = [120, 200, 280];
        const radius = circleRadii[circleIndex];

        // 当前圈内的设备数量
        const devicesPerCircle = Math.max(1, Math.ceil(total / 3));
        const circleDeviceIndex = index % devicesPerCircle;

        // 计算角度 (从顶部开始，-90度偏移)
        const angle = (circleDeviceIndex / devicesPerCircle) * 2 * Math.PI - Math.PI / 2;

        // 添加随机偏移避免完全对齐
        const angleOffset = (Math.random() * 0.2 - 0.1) * Math.PI;

        return {
            x: Math.cos(angle + angleOffset) * radius,
            y: Math.sin(angle + angleOffset) * radius,
            radius,
            angleDeg: (angle + angleOffset) * (180 / Math.PI),
            circleIndex
        };
    }, []);

    // 设备位置缓存
    const devicePositions = useMemo(() => {
        if (!scanResult?.devices.length) return [];
        return scanResult.devices.map((_, index) =>
            getDevicePosition(index, scanResult.devices.length)
        );
    }, [scanResult?.devices, getDevicePosition]);

    // 设备颜色映射
    const getDeviceColor = useCallback((circleIndex: number) => {
        const colors = [
            'bg-blue-500 hover:bg-blue-600',
            'bg-indigo-400 hover:bg-indigo-500',
            'bg-purple-300 hover:bg-purple-400'
        ];
        return colors[circleIndex] || colors[0];
    }, []);

    return (
        <div className="h-full bg-gradient-to-br from-gray-50 to-gray-100 text-gray-800 overflow-hidden relative">
            {/* 主内容 */}
            <div className="relative z-10 container mx-auto px-4 py-8">
                <div className="text-center mb-8">
                    <h1 className="text-2xl font-bold mb-2 text-transparent bg-clip-text bg-gradient-to-r from-slate-900 to-gray-800">
                        网络设备扫描器
                    </h1>
                    <p className="text-gray-600 max-w-2xl mx-auto">
                        输入IP地址和子网掩码扫描局域网中的活动设备
                    </p>

                    {/* 输入表单 */}
                    <div className="mt-6 max-w-md mx-auto bg-white rounded-xl p-6 shadow-lg border border-gray-200">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">IP地址</label>
                                <input
                                    type="text"
                                    value={ipAddress}
                                    onChange={(e) => setIpAddress(e.target.value)}
                                    className={`w-full px-3 py-2 rounded-lg border focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition ${isValid ? 'border-gray-300' : 'border-red-300'}`}
                                    placeholder="192.168.1.1"
                                />
                                {!isValid && (
                                    <p className="mt-1 text-xs text-red-500">请输入有效的IPv4地址</p>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">子网掩码</label>
                                <input
                                    type="text"
                                    value={subnetMask}
                                    onChange={(e) => setSubnetMask(e.target.value)}
                                    className={`w-full px-3 py-2 rounded-lg border focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition ${isValid ? 'border-gray-300' : 'border-red-300'}`}
                                    placeholder="255.255.255.0或/24"
                                />
                                {!isValid && (
                                    <p className="mt-1 text-xs text-red-500">请输入有效的子网掩码或CIDR</p>
                                )}
                            </div>
                        </div>
                        <Button
                            onClick={handleScan}
                            disabled={isLoading}
                            className='mt-2 w-full'
                        >{isLoading ? `扫描中... ${progress}%` : '开始扫描'}</Button>
                    </div>
                </div>

                {/* 扫描结果展示 */}
                {scanResult && (
                    <div className="mt-6">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                            <div>
                                <h2 className="text-xl font-semibold text-gray-800 mb-1">扫描结果</h2>
                                <p className="text-gray-600">
                                    范围: {scanResult.startRange} - {scanResult.endRange} |
                                    共发现 {scanResult.devices.length} 个活动设备
                                    {scanResult.totalCount > 0 && ` (总计 ${scanResult.totalCount})`}
                                </p>
                                {scanResult.error && (
                                    <p className="text-red-500 mt-2">{scanResult.error}</p>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="bg-gray-100 px-3 py-1.5 rounded-full text-sm text-gray-600 border border-gray-200">
                                    {new Date().toLocaleString()}
                                </div>
                            </div>
                        </div>
                        {/* 设备可视化圆环 */}
                        {scanResult.devices.length > 0 && (
                            <div className="relative h-[650px] w-full flex items-center justify-center mb-8 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                                {/* 绘制三个同心圆辅助线 */}
                                {[120, 200, 280].map((radius, i) => (
                                    <div
                                        key={i}
                                        className="absolute rounded-full border border-gray-200"
                                        style={{
                                            width: `${radius * 2}px`,
                                            height: `${radius * 2}px`,
                                            left: '50%',
                                            top: '50%',
                                            transform: 'translate(-50%, -50%)'
                                        }}
                                    />
                                ))}
                                {/* 中心点 */}
                                <div className="absolute w-4 h-4 bg-gray-700 rounded-full z-10" />
                                {/* 设备节点 */}
                                {scanResult.devices.map((device, index) => {
                                    const pos = devicePositions[index];
                                    if (!pos) return null;
                                    const size = 3.5 - pos.circleIndex * 0.5; // 内圈设备大一些
                                    return (
                                        <div
                                            key={`${device.ip}-${index}`}
                                            className={`absolute rounded-full shadow-md hover:shadow-lg transition-all duration-300 hover:scale-110 hover:z-20 group ${getDeviceColor(pos.circleIndex)}`}
                                            style={{
                                                width: `${size}rem`,
                                                height: `${size}rem`,
                                                left: `calc(50% + ${pos.x}px)`,
                                                top: `calc(50% + ${pos.y}px)`,
                                                transform: 'translate(-50%, -50%)',
                                                zIndex: 10 - pos.circleIndex // 内圈在上层
                                            }}
                                        >
                                            <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-white px-2 py-1 rounded text-xs whitespace-nowrap shadow-md border border-gray-200 text-gray-700">
                                                {device.hostname || device.ip}
                                            </div>
                                            <div className="h-full w-full flex items-center justify-center text-white">
                                                {
                                                    device.os === "Windows" ?
                                                        <Monitor size={20} /> :
                                                        ["Linux/Unix Server", "Linux/Unix", "Web Server OS"].includes(device.os || "") ? <Server /> : <Computer />
                                                }
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                        {/* 设备列表 */}
                        {scanResult.devices.length > 0 && (
                            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-5">
                                    {scanResult.devices.map((device, index) => (
                                        <div
                                            key={`${device.ip}-${index}`}
                                            className="bg-gray-50 hover:bg-white transition-all rounded-lg p-4 border-l-4 border-blue-500 shadow-sm hover:shadow-md"
                                        >
                                            <div className="flex items-center mb-2">
                                                <div className="bg-blue-100 p-2 rounded-full mr-3">
                                                    {
                                                        device.os === "Windows" ?
                                                            <Monitor size={20} className="text-blue-600" /> :
                                                            ["Linux/Unix Server", "Linux/Unix", "Web Server OS"].includes(device.os || "") ? <Server size={20} className="text-blue-600" /> : <Computer size={20} className="text-blue-600" />
                                                    }
                                                </div>
                                                <div>
                                                    <h3 className="font-medium text-gray-800 truncate max-w-[160px]">
                                                        {device.hostname || '未知设备'}
                                                    </h3>
                                                    <p className="text-xs text-gray-500">{device.ip}</p>
                                                </div>
                                            </div>
                                            <div className="mt-2 text-sm text-gray-600">
                                                {device.mac && <p className="truncate">MAC: {device.mac}</p>}
                                                {device.vendor && <p className="truncate">厂商: {device.vendor}</p>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        {/* 无设备提示 */}
                        {scanResult.devices.length === 0 && !scanResult.error && (
                            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                                <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                                    <MonitorOff size={25} />
                                </div>
                                <h3 className="text-lg font-medium text-gray-800 mb-1">未发现活动设备</h3>
                                <p className="text-gray-500">在指定网络范围内没有发现活动的设备</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default NetworkScanner;