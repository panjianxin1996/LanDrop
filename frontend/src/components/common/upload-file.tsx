import React, { useState, useCallback, useRef, ChangeEvent, useEffect } from 'react'
import axios from 'axios';
import { CloudUpload } from 'lucide-react'
import { autoUnitCalc } from "@/tools/tool"
import { Progress } from "@/components/ui/progress"
import useClientStore from "@/store/appStore"
import dayjs from 'dayjs'
import { Button } from "@/components/ui/button"

interface FileUploadProps {
  uploadUrl: string;
  acceptedFileTypes?: string;
  maxFileSize?: number;
  multiple?: boolean;
}
const FileUpload: React.FC<FileUploadProps> = ({
  uploadUrl,
  acceptedFileTypes = '*',
  maxFileSize = 5 * 1024 * 1024 * 1024, // 默认5GB
  multiple = false,
}) => {
  const { uploadedFiles, setStoreData, userInfo } = useClientStore()
  const [isDragging, setIsDragging] = useState(false); // 是否正在拖拽
  const [uploadList, setUploadList] = useState<any>([])
  const fileInputRef = useRef<HTMLInputElement>(null); // 文件输入框引用
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setUploadList(Object.entries(uploadedFiles).sort((a, b) => b[1] - a[1]).map(([key, val]) => {
      return {
        name: key,
        time: val,
        status: 'ok',
        statusMsg: '上传完成',
        progress: 100,
      }
    }))
  }, [uploadedFiles])
  // 处理拖拽事件
  const handleDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }, []);

  // 处理文件选择
  const handleFileInputChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
  }, []);

  const triggerFileInput = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // 验证文件
  const validateFile = (file: File): string | null => {
    if (file.size > maxFileSize) {
      return `文件大小超过限制 (最大 ${maxFileSize / 1024 / 1024}MB)`;
    }
    if (acceptedFileTypes !== '*' && !file.type.match(new RegExp(acceptedFileTypes.replace('*', '.*')))) {
      return '不支持的文件类型';
    }
    return null;
  };

  // 处理上传的文件
  const handleFiles = useCallback((files: FileList) => {
    let errors: string = "";
    const validFiles: File[] = [];
    Array.from(files).forEach((file) => {
      const error = validateFile(file);
      if (error) {
        errors = error;
      } else {
        validFiles.push(file);
      }
    });
    if (validFiles.length > 0) {
      uploadFiles(validFiles, errors);
    }
  }, [acceptedFileTypes, maxFileSize]);


  // 上传文件
  const uploadFiles = useCallback(async (files: File[], error: string) => {
    const formData = new FormData();
    files.forEach((file) => formData.append('file', file));
    try {
      await axios.post(uploadUrl, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          "X-Ld-Token": userInfo.token || "",
        },
        onUploadProgress: (progressEvent: any) => {
          if (progressEvent.total) {
            const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            let f = files[0]
            setUploadList((prev: any) => {
              // 不存在插入新数据
                if (prev.findIndex((file: any) => f.name === file.name) === -1) {
                  return [...prev, {
                    name: f.name,
                    time: new Date().getTime(),
                    status: !!error ? 'ok':'err',
                    statusMsg: !!error ? '': error,
                    progress: progress,
                  }]
                }
                // 存在更新进度
                return prev.map((item: any) => {
                  return item.name === f.name ? { ...item, progress } : item;
                })
            })
          }
        },
      });
      // 处理上传成功
      const newUploadedFiles: Record<string, number> = {};
      files.forEach((file) => {
        newUploadedFiles[file.name] = new Date().getTime();
      });
      setStoreData({
        beforeSet: (store, set) => {
          set({ uploadedFiles: { ...store.uploadedFiles, ...newUploadedFiles } });
        }
      })
    } catch (error) {
      console.error('上传失败:', error);
      const newErrors: Record<string, string> = {};
      files.forEach((file) => {
        newErrors[file.name] = '上传失败';
      });
      // setErrors((prev) => ({ ...prev, ...newErrors }));
    }
  }, [uploadUrl]);

  return (
    <div className="w-full mx-auto px-4">
      <div className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors duration-300 ${isDragging ? 'border-[#0f172a] bg-blue-50' : 'border-gray-300 hover:border-[#0f172a]'}`}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={triggerFileInput}
      >
        <div className="flex flex-col items-center pointer-events-none">
          <CloudUpload size={60} />
          <p className="mt-2 text-sm text-gray-600">
            <span className="font-medium text-blue-600">点击上传</span>
            <span>或拖拽文件到此处</span>
          </p>
          <p className="mt-1 text-xs text-gray-500">支持的文件类型: {acceptedFileTypes}</p>
          <p className="mt-1 text-xs text-gray-500">最大文件大小: {autoUnitCalc(maxFileSize).Unit}</p>
        </div>
        <input type="file" ref={fileInputRef} onChange={handleFileInputChange} accept={acceptedFileTypes} multiple={multiple} className="hidden" />
      </div>
      <div className='flex justify-end'>
        <Button className='my-2' onClick={() => setStoreData({ name: "uploadedFiles", value: {} })}>清空</Button>
      </div>
      {/* 上传进度和结果 */}
      <div ref={containerRef} className="mt-6 space-y-4 overflow-y-scroll h-3/5 flex flex-col">
        {uploadList.map((item: any) => (
          <div key={item.time} className="p-3 border rounded-lg">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium truncate max-w-xs">{item.name}</span>
              {
                item.progress === 100 && !item.status && <span className="text-xs text-gray-500">数据正在合成中。。。</span>
              }
              {item.status && (
                <div>
                  <span className="text-xs text-gray-400 mr-2">{dayjs(item.time).format("YYYY-MM-DD HH:mm:ss")}</span>
                  <span className={`text-sm ${item.status === 'err' ? "text-red-500" : "text-lime-500"}`}>{item.statusMsg}</span>
                </div>
              )}
            </div>
            {!(item.status === "ok") && (
              <div className='w-full flex items-center mt-2'>
                <Progress value={item.progress} />
                <p className="w-1/12 text-xs text-gray-500 text-right">
                  {item.progress}%
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default FileUpload;