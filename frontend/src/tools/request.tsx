import { toast } from "sonner";
import { useState, useCallback } from "react";
import useClientStore from "@/store/appStore";
import axios, { AxiosRequestConfig, AxiosError } from "axios"; // 引入 Axios

type RequestMethod = "GET" | "POST" | "PUT" | "DELETE";
type ErrorResponse = {
  statusText: string;
  message?: string;
};

/**
 * 自定义API请求Hook（Axios版本），封装了加载状态、错误处理和Toast通知功能
 * 
 * @returns {Object} 返回包含以下属性的对象:
 *   - request: 发起API请求的函数
 *   - isLoading: 是否正在加载中的状态
 *   - error: 请求失败时的错误信息
 *   - baseHost: 基础请求地址
 */
export function useApiRequest() {
  const { isClient,setStoreData,userInfo } = useClientStore();
  // 构建基础URL（逻辑与原fetch版本保持一致）
  const baseHost = `http://${
    isClient 
      ? `127.0.0.1:${localStorage.getItem("appPort") || "4321"}` 
      : location.host
  }`;
  const Host = `${baseHost}/api/v1`;

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ErrorResponse | null>(null);

  /**
   * 发起API请求（Axios实现）
   * 
   * @template T 期望的响应数据类型(默认为any)
   * @param {string} url API端点路径(会自动拼接Host)
   * @param {RequestMethod} [method="GET"] HTTP请求方法
   * @param {any} [data] 请求体数据(无需手动JSON.stringify)
   * @param {AxiosRequestConfig} [config] 额外的Axios配置(如headers、params等)
   * @returns {Promise<T | undefined>} 返回解析后的响应数据或undefined(请求失败时)
   */
  const request = useCallback(
    async <T = any>(
      url: string,
      method: RequestMethod = "GET",
      data?: any,
      config?: AxiosRequestConfig
    ): Promise<T | undefined> => {
      setIsLoading(true);
      setError(null);

      try {
        // 创建Axios实例（每次请求创建独立实例，避免拦截器全局污染）
        const instance = axios.create({
          baseURL: Host, // 基础URL
          headers: {
            "Content-Type": "application/json",
            "X-Ld-Token": userInfo.token || "",
          },
          ...config, // 合并额外配置（优先级更高）
        });

        // 发起请求
        const response = await instance.request<T>({
          url,
          method,
          data, // Axios会自动JSON.stringify(data)
        });

        return response.data; // 直接返回响应数据（Axios默认包裹在data中）

      } catch (err) {
        // 处理Axios错误
        const axiosError = err as AxiosError;
        const errorData: ErrorResponse = {
          statusText: axiosError.message || "请求失败",
        };

        // 尝试解析服务端返回的错误信息（兼容原fetch逻辑）
        if (axiosError.response?.data) {
          const responseData = axiosError.response.data as { msg?: string };
          errorData.message = responseData.msg;
        }
        if (axiosError.response?.status === 401) { // 登录失效清除用户数据
            localStorage.removeItem("userToken")
            setStoreData({
                beforeSet: (store, set) => {
                    set({
                        validExpToken: true,
                        userInfo: {
                            ...store.userInfo,
                            token: '',
                        },
                    })
                }
            })
        }
        setError(errorData);
        toast.error("请求出错", {
          description: `${url} 请求失败: ${errorData.message || errorData.statusText}`,
        });
        return undefined;
      } finally {
        setIsLoading(false);
      }
    },
    [Host] // 依赖Host变化时重新创建request函数
  );

  return { request, isLoading, error, baseHost };
}