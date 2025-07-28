import React, { useState, useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button"
import { CloudUpload, Download } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from '@/components/ui/textarea'

export default function Base64Translator() {
  const [base64, setBase64] = useState('');
  const [base64Input, setBase64Input] = useState('');
  const [imageSrc, setImageSrc] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [activeTab, setActiveTab] = useState('imgToBase64');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => setBase64(reader.result as string);
    reader.readAsDataURL(file);
  };

  // 处理 base64 转图片并在 canvas 中显示
  const handleBase64ToImage = () => {
    if (!base64Input) return;

    try {
      // 验证是否为有效的 base64 图片数据
      if (!base64Input.startsWith('data:image/')) {
        // 如果不是完整的 data URL，尝试添加默认的前缀
        const completeBase64 = base64Input.startsWith('data:')
          ? base64Input
          : `data:image/png;base64,${base64Input}`;
        setImageSrc(completeBase64);
      } else {
        setImageSrc(base64Input);
      }
    } catch (error) {
      console.error('Invalid base64 string', error);
    }
  };

  // 当 imageSrc 改变时，在 canvas 中绘制图片
  useEffect(() => {
    if (!imageSrc || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      // 设置 canvas 尺寸与图片相同以保持比例
      canvas.width = img.width;
      canvas.height = img.height;

      // 清除画布并绘制图片
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
    };
    img.src = imageSrc;
  }, [imageSrc, activeTab]);

  // Tab 切换时保持数据
  const handleTabChange = (value: string) => {
    setActiveTab(value);
  };

  // 下载 canvas 图片
  const downloadCanvasImage = () => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const link = document.createElement('a');
    link.download = 'canvas-image.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  return (
    <Tabs defaultValue="imgToBase64" onValueChange={handleTabChange}>
      <TabsList>
        <TabsTrigger value="imgToBase64">图片转base64</TabsTrigger>
        <TabsTrigger value="base64ToImg">base64转图片</TabsTrigger>
      </TabsList>

      <TabsContent value="imgToBase64" asChild>
        <div className="min-h-80 bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-6 space-y-6">
            <h1 className="text-2xl font-bold text-center text-gray-800">图片转 Base64</h1>

            {/* 文件上传 */}
            <div className="flex flex-col items-center justify-center border-2 border-dashed border-zinc-400 rounded-lg p-6 hover:bg-indigo-50 transition-colors cursor-pointer">
              <input
                type="file"
                accept="image/*"
                onChange={handleChange}
                className="hidden"
                id="file-upload"
              />
              <label
                htmlFor="file-upload"
                className="cursor-pointer flex flex-col items-center text-violet-950 font-medium"
              >
                <CloudUpload size={30} />
                选择图片
              </label>
            </div>
          </div>

          {/* 预览和结果 */}
          {base64 && (
            <div className="w-full flex gap-2 mt-4">
              <div className='w-2/5'>
                <h2 className="text-lg font-semibold text-gray-700">预览</h2>
                <div className='p-2 rounded-lg border border-gray-200 shadow-sm'>
                  <img
                    src={base64}
                    alt="Preview"
                    className="w-full h-auto"
                  />
                </div>
              </div>
              <div className='w-3/5 h-full'>
                <h2 className="text-lg font-semibold text-gray-700">Base64编码</h2>
                <div className='border-[1px] p-2 rounded'>
                  <p className='w-full line-clamp-4 break-words overflow-hidden text-sm text-gray-600'>{base64}</p>
                </div>

                <div className='text-right mt-2'>
                  <Button size={"sm"} onClick={() => navigator.clipboard.writeText(base64)}>复制</Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </TabsContent>

      <TabsContent value="base64ToImg">
        <div className="min-h-80 bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-white rounded-xl shadow-lg p-6 space-y-6">
            <h1 className="text-2xl font-bold text-center text-gray-800">Base64转图片</h1>

            {/* Base64 输入区域 */}
            <div className="space-y-4 text-right">
              <Textarea
                placeholder="请输入base64编码的图片数据"
                value={base64Input}
                onChange={(e) => setBase64Input(e.target.value)}
                className="min-h-[120px]"
              />
              <Button onClick={handleBase64ToImage}>转换为图片</Button>
            </div>

            {/* Canvas 显示区域 */}
            {(imageSrc || activeTab === 'base64ToImg') && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h2 className="text-lg font-semibold text-gray-700">图片预览</h2>
                  {imageSrc && (
                    <Button
                      size="sm"
                      onClick={downloadCanvasImage}
                      className="flex items-center gap-1"
                    >
                      <Download size={16} />
                      下载图片
                    </Button>
                  )}
                </div>
                <div className="flex justify-center border-2 border-dashed border-gray-300 rounded-lg p-4 bg-gray-50 min-h-[200px]">
                  <canvas
                    ref={canvasRef}
                    className="max-w-full max-h-[500px] object-contain"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </TabsContent>
    </Tabs>
  )
}