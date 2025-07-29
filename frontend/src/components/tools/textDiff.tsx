import React, { useState } from 'react';
import { DiffEditor } from '@monaco-editor/react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Upload, FileText, Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const TextDiffTool: React.FC = () => {
  const [original, setOriginal] = useState('');
  const [modified, setModified] = useState('');
  const [language, setLanguage] = useState('plain-text');
  const [theme, setTheme] = useState('vs-light');
  const [activeDropzone, setActiveDropzone] = useState<'original' | 'modified' | null>(null);
  const [isDiffFullscreen, setIsDiffFullscreen] = useState(false);

  const handleLanguageChange = (value: string) => {
    setLanguage(value);
  };

  const handleThemeChange = (value: string) => {
    setTheme(value);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>, setText: React.Dispatch<React.SetStateAction<string>>) => {
    if (event.target.files && event.target.files[0]) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result;
        setText(typeof text === 'string' ? text : '');
      };
      reader.readAsText(event.target.files[0]);
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>, setText: React.Dispatch<React.SetStateAction<string>>) => {
    event.preventDefault();
    setActiveDropzone(null);
    if (event.dataTransfer.files && event.dataTransfer.files[0]) {
      const file = event.dataTransfer.files[0];
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result;
        setText(typeof text === 'string' ? text : '');
      };
      reader.readAsText(file);
    }
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLDivElement>, setText: React.Dispatch<React.SetStateAction<string>>) => {
    const text = event.clipboardData.getData('text/plain');
    setText(text);
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const handleDragEnter = (event: React.DragEvent<HTMLDivElement>, zone: 'original' | 'modified') => {
    event.preventDefault();
    setActiveDropzone(zone);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    // 检查是否真正离开了区域
    if (!event.currentTarget.contains(event.relatedTarget as Node)) {
      setActiveDropzone(null);
    }
  };

  // Diff全屏功能
  const toggleDiffFullscreen = () => {
    setIsDiffFullscreen(!isDiffFullscreen);
  };

  // 为文件输入创建引用
  const originalFileInputRef = React.useRef<HTMLInputElement>(null);
  const modifiedFileInputRef = React.useRef<HTMLInputElement>(null);

  const handleChooseFileClick = (ref: React.RefObject<HTMLInputElement>) => {
    ref.current?.click();
  };

  return (
    <div className="bg-background">
      <div className="max-w-7xl mx-auto">
        <Card className="shadow-lg">
          <CardHeader className=' px-6 py-4'>
            <CardTitle className="text-2xl">文本对比</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col lg:flex-row gap-6">
              {/* 左侧控制面板 */}
              <div className="w-full lg:w-1/5 space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="language">语言</Label>
                  <Select value={language} onValueChange={handleLanguageChange}>
                    <SelectTrigger id="language">
                      <SelectValue placeholder="Select language" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="plain-text">PlainText</SelectItem>
                      <SelectItem value="javascript">JavaScript</SelectItem>
                      <SelectItem value="typescript">TypeScript</SelectItem>
                      <SelectItem value="json">JSON</SelectItem>
                      <SelectItem value="css">CSS</SelectItem>
                      <SelectItem value="html">HTML</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="theme">主题</Label>
                  <Select value={theme} onValueChange={handleThemeChange}>
                    <SelectTrigger id="theme">
                      <SelectValue placeholder="Select theme" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="vs-light">Light</SelectItem>
                      <SelectItem value="vs-dark">Dark</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* 右侧文件选择区域 */}
              <div className="w-full lg:w-4/5 grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                {/* Original 文件区域 */}
                <div>
                  <Label className="font-medium">对比文本</Label>
                  <div
                    className={`border-2 border-dashed rounded-lg p-2 h-48 flex flex-col items-center justify-center transition-all duration-200 ${
                      activeDropzone === 'original' 
                        ? 'border-primary bg-primary/20 scale-[1.02]' 
                        : 'border-muted bg-muted/30 hover:bg-muted/50'
                    }`}
                    onDrop={(e) => handleDrop(e, setOriginal)}
                    onDragOver={handleDragOver}
                    onDragEnter={(e) => handleDragEnter(e, 'original')}
                    onDragLeave={handleDragLeave}
                    onPaste={(e) => handlePaste(e, setOriginal)}
                    onFocus={() => setActiveDropzone('original')}
                    onBlur={() => setActiveDropzone(null)}
                    tabIndex={0}
                  >
                    <FileText className={`h-10 w-10 ${activeDropzone === 'original' ? 'text-primary' : 'text-muted-foreground'}`} />
                    <div className="text-center">
                      <p className={`font-medium ${activeDropzone === 'original' ? 'text-primary' : ''}`}>
                        {activeDropzone === 'original' ? '松开鼠标粘贴文件' : '将文件拖放到此处'}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">或直接粘贴文本</p>
                    </div>
                    <div className="relative mt-2">
                      <Input
                        ref={originalFileInputRef}
                        type="file"
                        onChange={(event) => handleFileUpload(event, setOriginal)}
                        className="hidden"
                      />
                      <Button 
                        variant="outline" 
                        className="cursor-pointer"
                        onClick={() => handleChooseFileClick(originalFileInputRef)}
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        选择文件
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">支持: txt, js, ts, json, css, html</p>
                  </div>
                </div>

                {/* Modified 文件区域 */}
                <div>
                  <Label className="font-medium">比较文本</Label>
                  <div
                    className={`border-2 border-dashed rounded-lg p-2 h-48 flex flex-col items-center justify-center transition-all duration-200 ${
                      activeDropzone === 'modified' 
                        ? 'border-primary bg-primary/20 scale-[1.02]' 
                        : 'border-muted bg-muted/30 hover:bg-muted/50'
                    }`}
                    onDrop={(e) => handleDrop(e, setModified)}
                    onDragOver={handleDragOver}
                    onDragEnter={(e) => handleDragEnter(e, 'modified')}
                    onDragLeave={handleDragLeave}
                    onPaste={(e) => handlePaste(e, setModified)}
                    onFocus={() => setActiveDropzone('modified')}
                    onBlur={() => setActiveDropzone(null)}
                    tabIndex={0}
                  >
                    <FileText className={`h-10 w-10 ${activeDropzone === 'modified' ? 'text-primary' : 'text-muted-foreground'}`} />
                    <div className="text-center">
                      <p className={`font-medium ${activeDropzone === 'modified' ? 'text-primary' : ''}`}>
                        {activeDropzone === 'modified' ? '松开鼠标粘贴文件' : '将文件拖放到此处'}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">或直接粘贴文本</p>
                    </div>
                    <div className="relative mt-2">
                      <Input
                        ref={modifiedFileInputRef}
                        type="file"
                        onChange={(event) => handleFileUpload(event, setModified)}
                        className="hidden"
                      />
                      <Button 
                        variant="outline" 
                        className="cursor-pointer"
                        onClick={() => handleChooseFileClick(modifiedFileInputRef)}
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        选择文件
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">支持: txt, js, ts, json, css, html</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Diff 预览区域 */}
            {isDiffFullscreen ? (
              // 全屏模式
              <div className="fixed inset-0 z-50 bg-background p-4">
                <div className="h-full border rounded-lg overflow-hidden relative">
                  <Button
                    variant="outline"
                    size="sm"
                    className="absolute top-2 right-2 z-10 flex items-center gap-1"
                    onClick={toggleDiffFullscreen}
                  >
                    <Minimize2 className="h-4 w-4" />
                    退出全屏
                  </Button>
                  <DiffEditor
                    original={original}
                    modified={modified}
                    language={language}
                    theme={theme}
                    options={{
                      renderSideBySide: true,
                      lineNumbersMinChars: 3,
                      scrollBeyondLastLine: false,
                      minimap: { enabled: false },
                      automaticLayout: true,
                    }}
                    height="100%"
                  />
                </div>
              </div>
            ) : (
              // 正常模式
              <div style={{ height: '50vh' }} className="border rounded-lg overflow-hidden relative">
                <Button
                  variant="outline"
                  size="sm"
                  className="absolute top-2 right-2 z-10 flex items-center gap-1"
                  onClick={toggleDiffFullscreen}
                >
                  <Maximize2 className="h-4 w-4" />
                  全屏
                </Button>
                <DiffEditor
                  original={original}
                  modified={modified}
                  language={language}
                  theme={theme}
                  options={{
                    renderSideBySide: true,
                    lineNumbersMinChars: 3,
                    scrollBeyondLastLine: false,
                    minimap: { enabled: false },
                    automaticLayout: true,
                  }}
                  height="100%"
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TextDiffTool;