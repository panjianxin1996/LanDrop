import { toast } from "sonner";
import { useState, useCallback } from "react";
import useClientStore from "@/store/appStore";
import axios, { AxiosProgressEvent, AxiosRequestConfig, AxiosError } from "axios";

type RequestMethod = "GET" | "POST" | "PUT" | "DELETE";
type ErrorResponse = {
  statusText: string;
  message?: string;
};

interface UploadResult {
  name: string;
  url: string;
  size: number;
}

interface UploadOptions extends AxiosRequestConfig {
  maxConcurrent?: number;      // 并发数（默认5）
  maxRetries?: number;         // 失败重试次数（默认2）
  onProgress?: (progress: {
    name: string;
    percent: number;
    total: number;
    loaded: number;
  }) => void;
}

export function useApiRequest() {
  const { isClient, setStoreData, userInfo } = useClientStore();
  const baseHost = `http://${isClient
    ? `127.0.0.1:${localStorage.getItem("appPort") || "4321"}`
    : location.host
  }`;
  const Host = `${baseHost}/api/v1`;

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ErrorResponse | null>(null);

  // 统一请求方法
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
        const instance = axios.create({
          baseURL: Host,
          headers: {
            "Content-Type": "application/json",
            "X-Ld-Token": userInfo.token || "",
          },
          ...config,
        });

        const response = await instance.request<T>({ url, method, data });
        setStoreData({ set: { validExpToken: false } });
        return response.data;

      } catch (err) {
        handleRequestError(err as AxiosError, url);
        return undefined;
      } finally {
        setIsLoading(false);
      }
    },
    [Host, userInfo.token]
  );

  // 统一上传方法
  const upload = useCallback(
    async (
      url: string,
      files: File[],
      options?: UploadOptions
    ): Promise<UploadResult[] | undefined> => {
      setIsLoading(true);
      setError(null);
      try {
        const { maxConcurrent = 5, maxRetries = 1, onProgress, ...config } = options || {};
        const results: UploadResult[] = [];
        const instance = axios.create({
          baseURL: Host,
          headers: {
            "Content-Type": "multipart/form-data",
            "X-Ld-Token": userInfo.token || "",
          },
          ...config,
        });

        // 并发控制器
        class Semaphore {
          private queue: (() => void)[] = [];
          constructor(private count: number) {}
          async acquire(): Promise<void> {
            if (this.count > 0) {
              this.count--;
              return Promise.resolve();
            }
            return new Promise(resolve => this.queue.push(resolve));
          }
          release(): void {
            this.count++;
            const next = this.queue.shift();
            if (next) next();
          }
        }
        const semaphore = new Semaphore(maxConcurrent);
        // 单文件上传
        const uploadFile = async (file: File, retry = 0): Promise<void> => {
          await semaphore.acquire();
          try {
            const formData = new FormData();
            formData.append("files", file);
            
            const response = await instance.post(url, formData, {
              ...config,
              onUploadProgress: (e: AxiosProgressEvent) => {
                if (e.total && onProgress) {
                  onProgress({
                    name: file.name,
                    percent: Math.round((e.loaded / e.total) * 100),
                    total: e.total,
                    loaded: e.loaded,
                  });
                }
              },
            });
            // console.log(response)
            if (response.data.code === 200) {
              response.data.data && results.push(...response.data.data);
            }
          } catch (err) {
            if (retry < maxRetries) {
              await uploadFile(file, retry + 1);
            } else {
              throw err;
            }
          } finally {
            semaphore.release();
          }
        };
        await Promise.all(files.map(file => uploadFile(file)));
        return results;
      } catch (err) {
        handleRequestError(err as AxiosError, url);
        return undefined;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  // 统一错误处理
  const handleRequestError = (error: AxiosError, url: string) => {
    const errorData: ErrorResponse = {
      statusText: error.message || "请求失败",
    };
    if (error.response?.data) {
      const responseData = error.response.data as { msg?: string };
      errorData.message = responseData.msg;
    }
    if (error.response?.status === 401) {
      localStorage.removeItem("userToken");
      setStoreData({
        before: (store, set) => {
          set({
            validExpToken: true,
            userInfo: { ...store.userInfo, token: '' },
          });
        },
      });
    } else {
      setStoreData({ set: { validExpToken: false } });
    }
    setError(errorData);
    toast.error("请求出错", {
      description: `${url} 请求失败: ${errorData.message || errorData.statusText}`,
    });
  };

  return { request, upload, isLoading, error, baseHost };
}