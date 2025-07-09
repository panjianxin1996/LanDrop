import { useEffect, useState } from 'react';

/**
 * 检测网络连接状态的Hook
 * @returns 当前网络连接状态 (true: 在线, false: 离线)
 */
export function useNetworkStatus() {
    const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);

    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true);
            console.log('网络已连接');
        };

        const handleOffline = () => {
            setIsOnline(false);
            console.log('网络已断开');
        };

        // 添加事件监听
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            // 清除事件监听
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    return isOnline;
}