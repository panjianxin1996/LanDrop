import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react'
import { Textarea } from "@/components/ui/textarea"
import { Toggle } from "@/components/ui/toggle"
import { CornerDownLeft, PanelTopOpen, PanelTopClose, CircleX } from 'lucide-react'
import useClientStore from '@/store/appStore'
import { Button } from '@/components/ui/button'
export interface ChatTextAreaRef {
    getInput: () => string;
    getFiles: () => File[];
    clear: () => void;
}
interface ChatTextAreaProps {
    className?: string;
    children?: React.ReactNode; // 定义插槽
    hasDataEvent?: (flag: boolean) => void;
}

const ChatTextArea = forwardRef<ChatTextAreaRef, ChatTextAreaProps>(({ className, children,hasDataEvent }, ref) => {
    const { setStoreData, enterKeyToSend } = useClientStore()
    const [input, setInput] = useState('');
    const [files, setFiles] = useState<Array<{ file: File, id: string, preview?: string }>>([]);
    const [isDragging, setIsDragging] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const filesContainerRef = useRef<HTMLDivElement>(null);
    const [openFilesBox, setOpenFilesBox] = useState<boolean>(true);
    const [canScroll, setCanScroll] = useState(false);
    const previewUrls = useRef<Set<string>>(new Set());

    // 内存管理
    useEffect(() => {
        return () => {
            previewUrls.current.forEach(url => URL.revokeObjectURL(url));
            previewUrls.current.clear();
        };
    }, []);

    useImperativeHandle(ref, () => ({
        getInput: () => input,
        getFiles: () => files.map(item => item.file),
        clear: () => {
            setInput('');
            setFiles(prev => {
                prev.forEach(file => {
                    if (file.preview) {
                        URL.revokeObjectURL(file.preview);
                        previewUrls.current.delete(file.preview);
                    }
                });
                return [];
            });
        }
    }));

    const addFiles = (newFiles: Array<{ file: File, preview?: string }>) => {
        const processedFiles = newFiles.map(item => {
            const id = Math.random().toString(36).substring(2, 11);
            let preview = item.preview;
            if (!preview && item.file.type.startsWith('image/')) {
                preview = URL.createObjectURL(item.file);
                previewUrls.current.add(preview);
            }
            return { ...item, id, preview };
        });
        setFiles(prev => [...prev, ...processedFiles]);
    };

    const handlePaste = (e: React.ClipboardEvent) => {
        if (!e.clipboardData.files.length) return;
        e.preventDefault();
        const newFiles = Array.from(e.clipboardData.files).map(file => ({
            file,
            preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined
        }));
        addFiles(newFiles);
    };

    const handleDragEnter = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };
    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (!e.dataTransfer.files.length) return;
        const newFiles = Array.from(e.dataTransfer.files).map(file => ({
            file,
            preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined
        }));
        addFiles(newFiles);
    };

    const removeFile = (id: string) => {
        setFiles(prev => {
            const fileToRemove = prev.find(f => f.id === id);
            if (fileToRemove?.preview) {
                URL.revokeObjectURL(fileToRemove.preview);
                previewUrls.current.delete(fileToRemove.preview);
            }
            return prev.filter(f => f.id !== id);
        });
    };

    useEffect(() => {
        const filesContainer = filesContainerRef.current;
        if (!filesContainer) return;
        const checkScrollAbility = () => {
            setCanScroll(filesContainer.scrollWidth > filesContainer.clientWidth);
        };
        checkScrollAbility();
        const resizeObserver = new ResizeObserver(checkScrollAbility);
        resizeObserver.observe(filesContainer);
        return () => resizeObserver.disconnect();
    }, []);

    useEffect(() => {
        const filesContainer = filesContainerRef.current;
        if (!filesContainer) return;
        const timer = setTimeout(() => {
            setCanScroll(filesContainer.scrollWidth > filesContainer.clientWidth);
        }, 50);
        return () => clearTimeout(timer);
    }, [files, openFilesBox]);

    useEffect(() => {
        const filesContainer = filesContainerRef.current;
        if (!filesContainer || !canScroll) return;
        const handleWheel = (e: WheelEvent) => {
            e.preventDefault();
            filesContainer.scrollLeft += e.deltaY;
        };
        filesContainer.addEventListener('wheel', handleWheel);
        return () => filesContainer.removeEventListener('wheel', handleWheel);
    }, [canScroll]);

    useEffect(()=>{
        hasDataEvent?.(files.length > 0  || !!input)
    },[files, input])

    const setPushEvent = () => {
        setStoreData({
            before: (store, set) => {
                set({ enterKeyToSend: !store.enterKeyToSend })
            }
        });
    };

    return (
        <div className={`relative w-full mx-auto ${className}`}>
            {(openFilesBox && files.length > 0) && (
                <div
                    ref={filesContainerRef}
                    className="absolute z-10 h-20 top-[-5.3rem] left-0 right-0 mb-2 p-1 border border-gray-200 rounded bg-gray-50 flex overflow-x-auto scrollbar-hide"
                    style={{ scrollBehavior: 'smooth' }}
                >
                    {files.map((item) => (
                        <div
                            key={item.id}
                            className="group flex-shrink-0 inline-flex items-center m-1 py-[2px] px-2 bg-white rounded border relative hover:shadow-md transition-all"
                        >
                            {item.preview ? (
                                <img
                                    src={item.preview}
                                    alt=""
                                    className="h-full max-w-[100px] object-contain"
                                />
                            ) : (
                                <span className="max-w-[120px] truncate">{item.file.name}</span>
                            )}
                            <Button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    removeFile(item.id);
                                }}
                                size="sm"
                                className="absolute -top-2 -right-2 w-5 h-5 p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-red-500 hover:bg-red-600 text-white shadow-md"
                            >
                                <CircleX size={12} />
                            </Button>
                        </div>
                    ))}
                </div>
            )}
            <div
                ref={containerRef}
                className="relative pr-12"
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
            >
                <div className='absolute top-0 right-0 flex flex-col'>
                    <Toggle
                        size="sm"
                        className="scale-75"
                        onClick={() => { setOpenFilesBox(!openFilesBox); setCanScroll(false); }}
                    >
                        {openFilesBox ?
                            <PanelTopOpen className="h-4 w-4" /> :
                            <PanelTopClose className="h-4 w-4" />
                        }
                    </Toggle>
                    <Toggle
                        size="sm"
                        className="scale-75"
                        pressed={enterKeyToSend}
                        onClick={setPushEvent}
                    >
                        <CornerDownLeft className="h-4 w-4" />
                    </Toggle>
                </div>

                <Textarea
                    id="message"
                    className="w-full min-h-[120px] p-3 border rounded bg-white resize-none"
                    autoComplete="off"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onPaste={handlePaste}
                    placeholder="输入消息..."
                />
                {
                    children
                }

                {isDragging && (
                    <div className="absolute inset-0 flex items-center justify-center bg-blue-50 bg-opacity-70 border-2 border-blue-500 rounded pointer-events-none">
                        <span className="text-blue-500 font-medium">松开鼠标上传文件</span>
                    </div>
                )}
            </div>
        </div>
    );
});

ChatTextArea.displayName = 'ChatTextArea';
export default ChatTextArea;