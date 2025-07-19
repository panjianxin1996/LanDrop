import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardHeader } from '@/components/ui/card';
interface ConsoleLog {
    type: 'log' | 'info' | 'warn' | 'error' | 'debug';
    args: any[];
    timestamp: Date;
}
declare global {
    interface XMLHttpRequest {
        _method: string;
        _url: string;
        _requestHeaders: Record<string, string>;
        _startTime: number;
    }
}
interface NetworkRequest {
    url: string;
    method: string;
    status?: number;
    statusText?: string;
    requestHeaders?: Record<string, string>;
    responseHeaders?: Record<string, string>;
    body?: any;
    response?: any;
    timestamp: Date;
    duration?: number;
    type: 'xhr' | 'fetch';
}
export function useConsole() {
    const [logs, setLogs] = useState<ConsoleLog[]>([]);
    const [requests, setRequests] = useState<NetworkRequest[]>([]);
    const [isListening, setIsListening] = useState(false);
    // 保存原始 console 方法
    const originalConsole: any = {
        log: console.log,
        info: console.info,
        warn: console.warn,
        error: console.error,
        debug: console.debug,
    };

    // 拦截 console 方法
    const interceptConsole = useCallback(() => {
        const consoleMethods = ['log', 'info', 'warn', 'error', 'debug'] as const;
        consoleMethods.forEach(method => {
            const originalMethod = originalConsole[method];
            console[method] = function (...args: any[]) {
                // 调用原始方法保持原有功能
                originalMethod.apply(console, args);
                // 记录日志
                setLogs(prev => [
                    ...prev,
                    {
                        type: method,
                        args,
                        timestamp: new Date(),
                    },
                ]);
            } as typeof originalMethod;
        });
    }, [originalConsole]);

    // 恢复原始 console 方法
    const restoreConsole = useCallback(() => {
        Object.keys(originalConsole).forEach(method => {
            console[method as keyof Console] = originalConsole[method as keyof Console];
        });
    }, [originalConsole]);

    // 拦截 XMLHttpRequest
    const interceptXHR = useCallback(() => {
        const originalXHROpen = XMLHttpRequest.prototype.open;
        const originalXHRSend = XMLHttpRequest.prototype.send;
        const originalXHRSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
        XMLHttpRequest.prototype.open = function (
            method: string,
            url: string | URL
        ) {
            this._method = method;
            this._url = typeof url === 'string' ? url : url.toString();
            this._requestHeaders = {};
            this._startTime = Date.now();

            return originalXHROpen.apply(this, arguments as any);
        };
        XMLHttpRequest.prototype.setRequestHeader = function (header: string, value: string) {
            this._requestHeaders[header] = value;
            return originalXHRSetRequestHeader.apply(this, arguments as any);
        };
        XMLHttpRequest.prototype.send = function (body?: Document | BodyInit | null) {
            const requestData: NetworkRequest = {
                url: this._url,
                method: this._method,
                requestHeaders: this._requestHeaders,
                body: body,
                timestamp: new Date(),
                type: 'xhr',
            };
            this.addEventListener('load', () => {
                const endTime = Date.now();
                const duration = endTime - this._startTime;
                try {
                    const response = this.responseType === '' || this.responseType === 'text'
                        ? this.responseText
                        : this.response;
                    requestData.response = response;
                    requestData.status = this.status;
                    requestData.statusText = this.statusText;
                    requestData.duration = duration;
                    const responseHeaders: Record<string, string> = {};
                    const headers = this.getAllResponseHeaders().trim().split(/[\r\n]+/);
                    headers.forEach(line => {
                        const parts = line.split(': ');
                        const header = parts.shift();
                        const value = parts.join(': ');
                        if (header) {
                            responseHeaders[header] = value;
                        }
                    });
                    requestData.responseHeaders = responseHeaders;
                    setRequests(prev => [...prev, requestData]);
                } catch (e) {
                    originalConsole.error('Failed to parse XHR response', e);
                }
            });
            this.addEventListener('error', () => {
                requestData.status = this.status;
                requestData.statusText = 'Request failed';
                setRequests(prev => [...prev, requestData]);
            });
            return originalXHRSend.apply(this, arguments as any);
        };
        return () => {
            XMLHttpRequest.prototype.open = originalXHROpen;
            XMLHttpRequest.prototype.send = originalXHRSend;
            XMLHttpRequest.prototype.setRequestHeader = originalXHRSetRequestHeader;
        };
    }, []);

    // 拦截 Fetch API
    const interceptFetch = useCallback(() => {
        const originalFetch = window.fetch;
        window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
            const startTime = Date.now();
            const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
            const method = init?.method || 'GET';
            const requestData: NetworkRequest = {
                url,
                method,
                requestHeaders: init?.headers as Record<string, string> || {},
                body: init?.body,
                timestamp: new Date(),
                type: 'fetch',
            };
            try {
                const response = await originalFetch(input, init);
                const endTime = Date.now();
                const duration = endTime - startTime;
                const clonedResponse = response.clone();
                const responseData = await (response.headers.get('Content-Type')?.includes('application/json')
                    ? clonedResponse.json()
                    : clonedResponse.text());
                const responseHeaders: Record<string, string> = {};
                response.headers.forEach((value, key) => {
                    responseHeaders[key] = value;
                });
                requestData.response = responseData;
                requestData.status = response.status;
                requestData.statusText = response.statusText;
                requestData.duration = duration;
                requestData.responseHeaders = responseHeaders;
                setRequests(prev => [...prev, requestData]);
                return response;
            } catch (error) {
                requestData.status = 0;
                requestData.statusText = 'Request failed';
                setRequests(prev => [...prev, requestData]);
                throw error;
            }
        };

        return () => {
            window.fetch = originalFetch;
        };
    }, []);

    // 开始监听
    const startListening = useCallback(() => {
        if (isListening) return;
        interceptConsole();
        const cleanupXHR = interceptXHR();
        const cleanupFetch = interceptFetch();
        setIsListening(true);
        return () => {
            restoreConsole();
            cleanupXHR();
            cleanupFetch();
            setIsListening(false);
        };
    }, [interceptConsole, interceptXHR, interceptFetch, isListening, restoreConsole]);

    // 停止监听
    const stopListening = useCallback(() => {
        if (!isListening) return;
        restoreConsole();
        setIsListening(false);
    }, [isListening, restoreConsole]);

    // 清空日志
    const clearLogs = useCallback(() => {
        setLogs([]);
    }, []);

    // 清空网络请求
    const clearRequests = useCallback(() => {
        setRequests([]);
    }, []);

    return {
        logs,
        requests,
        isListening,
        startListening,
        stopListening,
        clearLogs,
        clearRequests,
    };
}

// 展示组件
export const ConsoleViewer: React.FC<{
    logs: ConsoleLog[];
    requests: NetworkRequest[];
    onClearLogs?: () => void;
    onClearRequests?: () => void;
}> = ({ logs, requests, onClearLogs, onClearRequests }) => {
    const formatTimestamp = (date: Date) => {
        return date.toLocaleTimeString();
    };

    const stringify = (data: any) => {
        if (typeof data === 'object') {
            try {
                return JSON.stringify(data, null, 2);
            } catch {
                return String(data);
            }
        }
        return String(data);
    };

    const getLogTypeColor = (type: ConsoleLog['type']) => {
        switch (type) {
            case 'error': return 'bg-red-900 text-red-300';
            case 'warn': return 'bg-yellow-900 text-yellow-300';
            case 'info': return 'bg-blue-900 text-blue-300';
            default: return 'bg-gray-800 text-gray-200';
        }
    };

    const getRequestStatusColor = (status?: number) => {
        if (!status) return 'bg-red-900';
        if (status >= 400) return 'bg-red-900';
        if (status >= 300) return 'bg-yellow-900';
        return ' bg-cyan-900';
    };

    return (
        <Card className="h-full w-full">
            <CardHeader className="p-4">
                <Tabs defaultValue="console" className="w-full">
                    <div className="flex justify-between items-center">
                        <TabsList>
                            <TabsTrigger value="console">
                                Console <span className="ml-2 bg-gray-700 rounded-full px-2 py-0.5 text-xs text-white">{logs.length}</span>
                            </TabsTrigger>
                            <TabsTrigger value="network">
                                Network <span className="ml-2 bg-gray-700 rounded-full px-2 py-0.5 text-xs text-white">{requests.length}</span>
                            </TabsTrigger>
                        </TabsList>
                        <div>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={logs.length > 0 ? onClearLogs : onClearRequests}
                                className="text-muted-foreground hover:text-foreground"
                            >
                                Clear
                            </Button>
                        </div>
                    </div>

                    <TabsContent value="console" className="mt-4">
                        {logs.length === 0 ? (
                            <div className="text-center text-muted-foreground py-8">No console logs</div>
                        ) : (
                            <div className="space-y-2 h-[calc(100vh-200px)] overflow-y-auto">
                                {logs.map((log, index) => (
                                    <div
                                        key={index}
                                        className={`text-xs p-3 rounded-md ${getLogTypeColor(log.type)}`}
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className="text-xs text-muted-foreground min-w-[60px]">
                                                {formatTimestamp(log.timestamp)}
                                            </div>
                                            <div className="font-medium min-w-[40px]">
                                                {log.type.toUpperCase()}
                                            </div>
                                            <div className="break-words flex-1">
                                                {log.args.map((arg, i) => (
                                                    <span key={i}>{stringify(arg)} </span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </TabsContent>
                    <TabsContent value="network" className="mt-4">
                        {requests.length === 0 ? (
                            <div className="text-center text-muted-foreground py-8">No network requests</div>
                        ) : (
                            <div className="space-y-3 h-[calc(100vh-200px)] overflow-y-auto">
                                {requests.map((req, index) => (
                                    <details
                                        key={index}
                                        className={`text-white text-xs rounded-lg border overflow-hidden ${getRequestStatusColor(req.status)}`}
                                    >
                                        <summary className="px-4 py-3 cursor-pointer flex items-center">
                                            <div className="flex-1 flex items-center gap-2">
                                                <span className="w-10">{req.method}</span>
                                                <span className="text-blue-300 truncate max-w-[300px]">{req.url}</span>
                                                {req.status !== undefined && (
                                                    <span className={`font-semibold ${req.status >= 400 || req.status === 0 ? 'text-red-400' : 'text-green-400'
                                                        }`}>
                                                        {req.status} {req.statusText}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                                {req.duration !== undefined && (
                                                    <span>{req.duration}ms</span>
                                                )}
                                                <span>{formatTimestamp(req.timestamp)}</span>
                                            </div>
                                        </summary>
                                        <div className="p-4 space-y-4 bg-gray-900">
                                            {req.requestHeaders && Object.keys(req.requestHeaders).length > 0 && (
                                                <div>
                                                    <h4 className="font-medium mb-2">Request Headers</h4>
                                                    <pre className="bg-gray-800 p-3 rounded text-sm text-white overflow-x-auto">
                                                        {JSON.stringify(req.requestHeaders, null, 2)}
                                                    </pre>
                                                </div>
                                            )}
                                            {req.body && (
                                                <div>
                                                    <h4 className="font-medium mb-2">Request Body</h4>
                                                    <pre className="bg-gray-800 p-3 rounded text-sm text-white overflow-x-auto">
                                                        {stringify(req.body)}
                                                    </pre>
                                                </div>
                                            )}
                                            {req.responseHeaders && Object.keys(req.responseHeaders).length > 0 && (
                                                <div>
                                                    <h4 className="font-medium mb-2">Response Headers</h4>
                                                    <pre className="bg-gray-800 p-3 rounded text-sm text-white overflow-x-auto">
                                                        {JSON.stringify(req.responseHeaders, null, 2)}
                                                    </pre>
                                                </div>
                                            )}
                                            {req.response !== undefined && (
                                                <div>
                                                    <h4 className="font-medium mb-2">Response</h4>
                                                    <pre className="bg-gray-800 p-3 rounded text-sm text-white overflow-x-auto">
                                                        {stringify(req.response)}
                                                    </pre>
                                                </div>
                                            )}
                                        </div>
                                    </details>
                                ))}
                            </div>
                        )}
                    </TabsContent>
                </Tabs>
            </CardHeader>
        </Card>
    );
};