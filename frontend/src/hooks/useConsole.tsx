import { useState, useCallback, useEffect, useRef, memo } from 'react';
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
type ConsoleMethod = {
    (...data: any[]): void;
    (message?: any, ...optionalParams: any[]): void;
};
type ConsoleMethodsToIntercept = 'log' | 'info' | 'warn' | 'error' | 'debug';

interface UseConsoleReturn {
    subscribe: (callback: () => void) => () => void;
    getState: () => {
        logs: ConsoleLog[];
        requests: NetworkRequest[];
        isListening: boolean;
    };
    startListening: () => void;
    stopListening: () => void;
    clearLogs: () => void;
    clearRequests: () => void;
}
export function useConsole(): UseConsoleReturn {
    // 使用 ref 存储所有状态，完全隔离于 React 渲染系统
    const stateRef = useRef({
        logs: [] as ConsoleLog[],
        requests: [] as NetworkRequest[],
        isListening: false,
        subscribers: new Set<() => void>(),
    });

    // 存储原始方法
    const originalMethods = useRef({
        console: {
            log: console.log,
            info: console.info,
            warn: console.warn,
            error: console.error,
            debug: console.debug,
        },
        xhr: {
            open: XMLHttpRequest.prototype.open,
            send: XMLHttpRequest.prototype.send,
            setRequestHeader: XMLHttpRequest.prototype.setRequestHeader,
        },
        fetch: window.fetch,
    });

    // 通知订阅者更新
    const notifySubscribers = useCallback(() => {
        stateRef.current.subscribers.forEach(cb => cb());
    }, []);

    // 添加日志 (完全隔离，不触发 React 更新)
    const addLog = useCallback((log: ConsoleLog) => {
        const newLogs = [...stateRef.current.logs.slice(-999), log]; // 限制最大1000条
        stateRef.current.logs = newLogs;
        notifySubscribers();
    }, [notifySubscribers]);

    // 添加请求 (完全隔离，不触发 React 更新)
    const addRequest = useCallback((request: NetworkRequest) => {
        const newRequests = [...stateRef.current.requests.slice(-99), request]; // 限制最大100条
        stateRef.current.requests = newRequests;
        notifySubscribers();
    }, [notifySubscribers]);

    // 拦截 console 方法 (优化版，避免循环)
    const interceptConsole = useCallback(() => {
        const methods: ConsoleMethodsToIntercept[] = ['log', 'info', 'warn', 'error', 'debug'];

        methods.forEach(method => {
            const originalMethod = originalMethods.current.console[method];

            const interceptedMethod: ConsoleMethod = (...args: any[]) => {
                // 1. 先调用原始方法
                originalMethod.apply(console, args);

                // 2. 记录日志
                try {
                    addLog({
                        type: method,
                        args,
                        timestamp: new Date(),
                    });
                } catch (e) {
                    originalMethod('Failed to log intercepted console call:', e);
                }
            };

            // 使用类型断言确保类型匹配
            (console[method] as ConsoleMethod) = interceptedMethod;
        });
    }, [addLog]);

    // 恢复原始 console 方法
    const restoreConsole = useCallback(() => {
        Object.entries(originalMethods.current.console).forEach(([method, original]) => {
            console[method as ConsoleMethodsToIntercept] = original as ConsoleMethod;
        });
    }, []);

    // 拦截 XMLHttpRequest (优化版)
    const interceptXHR = useCallback(() => {
        const { open, send, setRequestHeader } = originalMethods.current.xhr;

        XMLHttpRequest.prototype.open = function (method: string, url: string | URL) {
            this._method = method;
            this._url = typeof url === 'string' ? url : url.toString();
            this._requestHeaders = {};
            this._startTime = Date.now();
            return open.apply(this, arguments as any);
        };

        XMLHttpRequest.prototype.setRequestHeader = function (header: string, value: string) {
            this._requestHeaders[header] = value;
            return setRequestHeader.apply(this, arguments as any);
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
                try {
                    const duration = Date.now() - this._startTime;
                    const response = this.responseType === '' || this.responseType === 'text'
                        ? this.responseText
                        : this.response;

                    addRequest({
                        ...requestData,
                        response,
                        status: this.status,
                        statusText: this.statusText,
                        duration,
                        responseHeaders: this.getAllResponseHeaders()
                            .split('\r\n')
                            .reduce((acc, line) => {
                                const [header, value] = line.split(': ');
                                if (header) acc[header] = value;
                                return acc;
                            }, {} as Record<string, string>)
                    });
                } catch (e) {
                    originalMethods.current.console.error('Failed to parse XHR response', e);
                }
            });

            this.addEventListener('error', () => {
                addRequest({
                    ...requestData,
                    status: this.status || 0,
                    statusText: 'Request failed'
                });
            });

            return send.apply(this, arguments as any);
        };

        return () => {
            XMLHttpRequest.prototype.open = open;
            XMLHttpRequest.prototype.send = send;
            XMLHttpRequest.prototype.setRequestHeader = setRequestHeader;
        };
    }, [addRequest]);

    // 拦截 Fetch API (优化版)
    const interceptFetch = useCallback(() => {
        const { fetch: originalFetch } = originalMethods.current;

        window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
            const startTime = Date.now();
            const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

            const requestData: NetworkRequest = {
                url,
                method: init?.method || 'GET',
                requestHeaders: init?.headers as Record<string, string> || {},
                body: init?.body,
                timestamp: new Date(),
                type: 'fetch',
            };

            try {
                const response = await originalFetch(input, init);
                const duration = Date.now() - startTime;
                const clonedResponse = response.clone();

                const responseData = response.headers.get('Content-Type')?.includes('application/json')
                    ? await clonedResponse.json()
                    : await clonedResponse.text();

                const responseHeaders: Record<string, string> = {};
                response.headers.forEach((value, key) => {
                    responseHeaders[key] = value;
                });

                addRequest({
                    ...requestData,
                    response: responseData,
                    status: response.status,
                    statusText: response.statusText,
                    duration,
                    responseHeaders
                });

                return response;
            } catch (error) {
                addRequest({
                    ...requestData,
                    status: 0,
                    statusText: 'Request failed'
                });
                throw error;
            }
        };

        return () => {
            window.fetch = originalFetch;
        };
    }, [addRequest]);

    // 订阅状态变化（供 UI 组件使用）
    const subscribe = useCallback((callback: () => void) => {
        stateRef.current.subscribers.add(callback);
        return () => {
            stateRef.current.subscribers.delete(callback);
        };
    }, []);

    // 开始监听
    const startListening = useCallback(() => {
        if (stateRef.current.isListening) return;

        interceptConsole();
        const cleanupXHR = interceptXHR();
        const cleanupFetch = interceptFetch();

        stateRef.current.isListening = true;
        notifySubscribers();

        return () => {
            restoreConsole();
            cleanupXHR();
            cleanupFetch();
            stateRef.current.isListening = false;
            notifySubscribers();
        };
    }, [interceptConsole, interceptXHR, interceptFetch, restoreConsole, notifySubscribers]);

    // 停止监听
    const stopListening = useCallback(() => {
        if (!stateRef.current.isListening) return;
        restoreConsole();
        stateRef.current.isListening = false;
        notifySubscribers();
    }, [restoreConsole, notifySubscribers]);

    // 清空日志
    const clearLogs = useCallback(() => {
        stateRef.current.logs = [];
        notifySubscribers();
    }, [notifySubscribers]);

    // 清空网络请求
    const clearRequests = useCallback(() => {
        stateRef.current.requests = [];
        notifySubscribers();
    }, [notifySubscribers]);

    // 获取当前状态（快照）
    const getState = useCallback(() => ({
        logs: [...stateRef.current.logs],
        requests: [...stateRef.current.requests],
        isListening: stateRef.current.isListening,
    }), []);

    return {
        subscribe,
        getState,
        startListening,
        stopListening,
        clearLogs,
        clearRequests,
    };
}

// 展示组件
export const ConsoleViewer = memo(({
    onClearLogs,
    onClearRequests,
    useConsole
}: {
    onClearLogs?: () => void;
    onClearRequests?: () => void;
    useConsole: UseConsoleReturn;
}) => {
    const [state, setState] = useState(useConsole.getState());

    useEffect(() => {
        return useConsole.subscribe(() => {
            setState(useConsole.getState());
        });
    }, [useConsole]);

    const formatTimestamp = (date: Date) => date.toLocaleTimeString();

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
        return 'bg-cyan-900';
    };

    return (
        <Card className="h-full w-full">
            <CardHeader className="p-4">
                <Tabs defaultValue="console" className="w-full">
                    <div className="flex justify-between items-center">
                        <TabsList>
                            <TabsTrigger value="console">
                                Console <span className="ml-2 bg-gray-700 rounded-full px-2 py-0.5 text-xs text-white">{state.logs.length}</span>
                            </TabsTrigger>
                            <TabsTrigger value="network">
                                Network <span className="ml-2 bg-gray-700 rounded-full px-2 py-0.5 text-xs text-white">{state.requests.length}</span>
                            </TabsTrigger>
                        </TabsList>
                        <div>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={state.logs.length > 0 ? onClearLogs : onClearRequests}
                                className="text-muted-foreground hover:text-foreground"
                            >
                                Clear
                            </Button>
                        </div>
                    </div>

                    <TabsContent value="console" className="mt-4">
                        {state.logs.length === 0 ? (
                            <div className="text-center text-muted-foreground py-8">No console logs</div>
                        ) : (
                            <div className="space-y-2 h-[calc(100vh-200px)] overflow-y-auto">
                                {state.logs.map((log, index) => (
                                    <div
                                        key={`log-${index}`}
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
                                                    <span key={`arg-${i}`}>{stringify(arg)} </span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent value="network" className="mt-4">
                        {state.requests.length === 0 ? (
                            <div className="text-center text-muted-foreground py-8">No network requests</div>
                        ) : (
                            <div className="space-y-3 h-[calc(100vh-200px)] overflow-y-auto">
                                {state.requests.map((req, index) => (
                                    <details
                                        key={`req-${index}`}
                                        className={`text-white text-xs rounded-lg border overflow-hidden ${getRequestStatusColor(req.status)}`}
                                    >
                                        <summary className="px-4 py-3 cursor-pointer flex items-center">
                                            <div className="flex-1 flex items-center gap-2">
                                                <span className="w-10">{req.method}</span>
                                                <span className="text-blue-300 truncate max-w-[300px]">{req.url}</span>
                                                {req.status !== undefined && (
                                                    <span className={`font-semibold ${req.status >= 400 || req.status === 0 ? 'text-red-400' : 'text-green-400'}`}>
                                                        {req.status} {req.statusText}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                                {req.duration !== undefined && <span>{req.duration}ms</span>}
                                                <span>{formatTimestamp(req.timestamp)}</span>
                                            </div>
                                        </summary>
                                        <div className="p-4 space-y-4 bg-gray-900">
                                            {req.requestHeaders && Object.keys(req.requestHeaders).length > 0 && (
                                                <div>
                                                    <h4 className="font-medium mb-2">Request Headers</h4>
                                                    <pre className="bg-gray-800 p-3 rounded text-sm text-white overflow-x-auto">
                                                        {stringify(req.requestHeaders)}
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
                                                        {stringify(req.responseHeaders)}
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
});