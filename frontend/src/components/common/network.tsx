import { useState } from 'react';
import { ToolsScanNetwork } from "@clientSDK/App"

interface Device {
    ip: string;
    hostname: string;
    mac?: string;
    vendor?: string;
}

interface ScanResult {
    startRange: string;
    endRange: string;
    devices: Device[];
    totalCount: number;
    error?: string;
}

const NetworkScannerDisplay = () => {
    const [scanResult, setScanResult] = useState<ScanResult | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [ipAddress, setIpAddress] = useState('192.168.1.1');
    const [subnetMask, setSubnetMask] = useState('255.255.255.0');
    const [isValid, setIsValid] = useState(true);

    console.log("出发渲染。")

    // 验证IP和子网掩码格式
    const validateInputs = () => {
        const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
        const maskRegex = /^(\d{1,3}\.){3}\d{1,3}$|^\/\d{1,2}$/;
        if (!ipRegex.test(ipAddress) || !maskRegex.test(subnetMask)) {
            setIsValid(false);
            return false;
        }
        setIsValid(true);
        return true;
    };

    // 扫描网络
    const simulateScan = () => {
        if (!validateInputs()) return;
        setIsLoading(true);
        setProgress(0);

        const interval = setInterval(() => {
            setProgress(prev => {
                if (prev >= 100) {
                    clearInterval(interval);
                    setIsLoading(false);
                    return 100;
                }
                return prev + 5;
            });
        }, 200);

        ToolsScanNetwork(ipAddress, subnetMask).then((res: any) => {
            setScanResult(res)
        }).catch(error => {
            setScanResult({
                startRange: ipAddress,
                endRange: ipAddress,
                devices: [],
                totalCount: 0,
                error: error.message
            });
        }).finally(() => {
            clearInterval(interval);
            setIsLoading(false);
            setProgress(100);
        });
    };

    // 计算设备在多圈圆弧上的位置
    const getDevicePosition = (index: number, total: number) => {
        // 计算应该放在第几圈 (0: 内圈, 1: 中圈, 2: 外圈)
        const circleIndex = Math.min(2, Math.floor(index / (total / 3)));

        // 每圈的半径
        const circleRadii = [120, 200, 280];
        const radius = circleRadii[circleIndex];

        // 当前圈内的设备数量
        const devicesPerCircle = Math.ceil(total / 3);
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
    };

    return (
        <div className="min-h-screen bg-gray-900 text-white overflow-hidden relative">
            {/* 动态背景圆圈 */}
            <div className="absolute inset-0 overflow-hidden">
                {[...Array(10)].map((_, i) => (
                    <div
                        key={i}
                        className="absolute rounded-full border border-gray-700 opacity-20"
                        style={{
                            width: `${100 + i * 100}px`,
                            height: `${100 + i * 100}px`,
                            left: `${Math.random() * 100}%`,
                            top: `${Math.random() * 100}%`,
                            transform: `translate(-50%, -50%)`
                        }}
                    />
                ))}
            </div>

            {/* 主内容 */}
            <div className="relative z-10 container mx-auto px-4 py-12">
                <div className="text-center mb-12">
                    <h1 className="text-4xl font-bold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-600">
                        网络设备扫描器
                    </h1>
                    <p className="text-gray-400 max-w-2xl mx-auto">
                        输入IP地址和子网掩码扫描局域网中的活动设备
                    </p>

                    {/* 输入表单 */}
                    <div className="mt-8 max-w-md mx-auto bg-gray-800 bg-opacity-50 rounded-xl p-6 backdrop-blur-sm">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">
                                    IP地址
                                </label>
                                <input
                                    type="text"
                                    value={ipAddress}
                                    onChange={(e) => setIpAddress(e.target.value)}
                                    className={`w-full px-4 py-2 rounded-lg bg-gray-700 border ${isValid ? 'border-gray-600' : 'border-red-500'
                                        } focus:border-blue-500 focus:ring-2 focus:ring-blue-500 outline-none transition`}
                                    placeholder="例如: 192.168.1.1"
                                />
                                {!isValid && (
                                    <p className="mt-1 text-xs text-red-400">请输入有效的IPv4地址</p>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">
                                    子网掩码
                                </label>
                                <input
                                    type="text"
                                    value={subnetMask}
                                    onChange={(e) => setSubnetMask(e.target.value)}
                                    className={`w-full px-4 py-2 rounded-lg bg-gray-700 border ${isValid ? 'border-gray-600' : 'border-red-500'
                                        } focus:border-blue-500 focus:ring-2 focus:ring-blue-500 outline-none transition`}
                                    placeholder="例如: 255.255.255.0 或 /24"
                                />
                                {!isValid && (
                                    <p className="mt-1 text-xs text-red-400">请输入有效的子网掩码或CIDR</p>
                                )}
                            </div>
                        </div>

                        <button
                            onClick={simulateScan}
                            disabled={isLoading}
                            className={`mt-6 w-full px-6 py-3 rounded-full font-medium transition-all ${isLoading
                                ? 'bg-blue-800 cursor-not-allowed'
                                : 'bg-blue-600 hover:bg-blue-700 hover:shadow-lg'
                                }`}
                        >
                            {isLoading ? `扫描中... ${progress}%` : '开始扫描'}
                        </button>
                    </div>
                </div>

                {/* 扫描结果展示 */}
                {scanResult && (
                    <div className="mt-8">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                            <div>
                                <h2 className="text-2xl font-semibold mb-1">扫描结果</h2>
                                <p className="text-gray-400">
                                    范围: {scanResult.startRange} - {scanResult.endRange} |
                                    共 {scanResult.devices.length} 个活动设备 (总计 {scanResult.totalCount})
                                </p>
                                {scanResult.error && (
                                    <p className="text-red-400 mt-2">{scanResult.error}</p>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="bg-gray-800 px-4 py-2 rounded-full text-sm">
                                    {new Date().toLocaleString()}
                                </div>
                            </div>
                        </div>

                        {/* 设备可视化圆环 */}
                        <div className="relative h-[600px] w-full flex items-center justify-center mb-12">
                            {/* 绘制三个同心圆辅助线 */}
                            {[120, 200, 280].map((radius, i) => (
                                <div
                                    key={i}
                                    className="absolute rounded-full border border-gray-700 opacity-20"
                                    style={{
                                        width: `${radius * 2}px`,
                                        height: `${radius * 2}px`,
                                        left: '50%',
                                        top: '50%',
                                        transform: 'translate(-50%, -50%)'
                                    }}
                                />
                            ))}

                            {/* 设备节点 */}
                            {scanResult.devices.map((device, index) => {
                                const pos = getDevicePosition(index, scanResult.devices.length);
                                const size = 3.5 - pos.circleIndex * 0.5; // 内圈设备大一些
                                return (
                                    <div
                                        key={device.ip}
                                        className={`absolute rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110 hover:z-10 group 
                                            ${pos.circleIndex === 0 ? 'bg-blue-500 hover:bg-purple-500' :
                                                pos.circleIndex === 1 ? 'bg-blue-400 hover:bg-purple-400' :
                                                    'bg-blue-300 hover:bg-purple-300'}`}
                                        style={{
                                            width: `${size}rem`,
                                            height: `${size}rem`,
                                            left: `calc(50% + ${pos.x}px)`,
                                            top: `calc(50% + ${pos.y}px)`,
                                            transform: 'translate(-50%, -50%)',
                                            zIndex: 3 - pos.circleIndex // 内圈在上层
                                        }}
                                    >
                                        <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-gray-800 px-3 py-1 rounded text-xs whitespace-nowrap">
                                            {device.hostname}
                                        </div>
                                        <div className="h-full w-full flex items-center justify-center">
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                            </svg>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* 设备列表 */}
                        {scanResult.devices.length > 0 && (
                            <div className="bg-gray-800 bg-opacity-50 backdrop-blur-sm rounded-xl overflow-hidden">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
                                    {scanResult.devices.map(device => (
                                        <div
                                            key={device.ip}
                                            className="bg-gray-800 bg-opacity-70 hover:bg-opacity-100 transition-all rounded-lg p-4 border-l-4 border-blue-500"
                                        >
                                            <div className="flex items-center mb-2">
                                                <div className="bg-blue-600 bg-opacity-20 p-2 rounded-full mr-3">
                                                    <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                                    </svg>
                                                </div>
                                                <div>
                                                    <h3 className="font-medium">{device.hostname}</h3>
                                                    <p className="text-xs text-gray-400">{device.ip}</p>
                                                </div>
                                            </div>
                                            <div className="mt-2 text-sm text-gray-300">
                                                {device.mac && <p>MAC: {device.mac}</p>}
                                                {device.vendor && <p>厂商: {device.vendor}</p>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default NetworkScannerDisplay;