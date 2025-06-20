import { toast } from "sonner"
import { useState, useCallback } from "react"
import useClientStore from "@/store/appStore"
type RequestMethod = "GET" | "POST" | "PUT" | "DELETE"
type ErrorResponse = {
    statusText: string
    message?: string
}
/**
 * 自定义API请求Hook，封装了加载状态、错误处理和Toast通知功能
 * 
 * @returns {Object} 返回包含以下属性的对象:
 *   - request: 发起API请求的函数
 *   - isLoading: 是否正在加载中的状态
 *   - error: 请求失败时的错误信息
 */
export function useApiRequest() {
    const { isClient } = useClientStore()
    let baseHost = `http://${isClient ? "127.0.0.1:4321" : location.host}`
    let Host = baseHost + "/api/v1"
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<ErrorResponse | null>(null)
    /**
     * 发起API请求
     * 
     * @template T 期望的响应数据类型(默认为any)
     * @param {string} url API端点路径(会自动拼接Host)
     * @param {RequestMethod} [method="GET"] HTTP请求方法
     * @param {any} [body] 请求体(会自动JSON序列化)
     * @returns {Promise<T | undefined>} 返回解析后的JSON数据或undefined(当请求失败时)
     */
    const request = useCallback(
        async <T = any>(url: string, method: RequestMethod = "GET", body?: any): Promise<T | undefined> => {
            setIsLoading(true)
            setError(null)
            try {
                const response = await fetch(Host + url, {
                    method,
                    headers: {
                        "Content-Type": "application/json",
                        "X-Ld-Token": localStorage.getItem("ldtoken") || "",
                    },
                    body: body ? JSON.stringify(body) : undefined,
                })
                if (!response.ok) {
                    const errorData: ErrorResponse = {
                        statusText: response.statusText,
                    }
                    try {
                        const errorResponse = await response.json()
                        errorData.message = errorResponse.msg
                    } catch (e: any) {
                        errorData.message = e
                    }
                    setError(errorData)
                    toast.error("请求出错", {
                        description: `${url} 请求失败: ${!!errorData.message && errorData.message}`
                    })
                    return undefined
                }
                return await response.json()
            } catch (err) {
                const error = err as Error
                setError({
                    statusText: error.message || "网络错误",
                })
                toast.error("网络错误", {
                    description: `${url} 请求失败: ${!!error.message && error.message}`
                })
                return undefined
            } finally {
                setIsLoading(false)
            }
        },
        [toast]
    )
    return { request, isLoading, error, baseHost }
}