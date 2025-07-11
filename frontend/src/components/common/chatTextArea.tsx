import React, { useState, useRef, useEffect } from 'react';

interface ImageData {
    src: string;
    id: string;
}

const ImageInputBox: React.FC = () => {
    const [content, setContent] = useState<string>('');
    const [images, setImages] = useState<ImageData[]>([]);
    const [isDragging, setIsDragging] = useState<boolean>(false);
    const editableDivRef = useRef<HTMLDivElement>(null);

    // 更新内容状态
    const updateContent = () => {
        if (editableDivRef.current) {
            setContent(editableDivRef.current.innerHTML);
        }
    };

    // 处理粘贴事件
    const handlePaste = (e: React.ClipboardEvent) => {
        const items = e.clipboardData.items;
        let hasImage = false;

        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                const blob = items[i].getAsFile();
                if (blob) {
                    processImageFile(blob);
                    hasImage = true;
                }
                break;
            }
        }

        if (hasImage) {
            e.preventDefault();
        }

        // 延迟更新以确保DOM已更新
        setTimeout(updateContent, 0);
    };

    // 处理拖拽事件
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => {
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);

        const files = e.dataTransfer.files;
        if (files.length > 0) {
            for (let i = 0; i < files.length; i++) {
                if (files[i].type.startsWith('image/')) {
                    processImageFile(files[i]);
                }
            }
        }

        updateContent();
    };

    // 处理图片文件
    const processImageFile = (file: File) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const imageUrl = e.target?.result as string;
            const newImage: ImageData = {
                src: imageUrl,
                id: Date.now().toString()
            };
            setImages(prev => [...prev, newImage]);

            // 插入图片到可编辑区域
            if (editableDivRef.current) {
                const img = document.createElement('img');
                img.src = imageUrl;
                img.style.maxWidth = '200px';
                img.style.maxHeight = '200px';
                img.style.margin = '10px 0';
                img.style.borderRadius = '4px';
                img.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';

                editableDivRef.current.appendChild(img);

                // 移动光标到图片后
                const range = document.createRange();
                range.selectNodeContents(editableDivRef.current);
                range.collapse(false);
                const selection = window.getSelection();
                if (selection) {
                    selection.removeAllRanges();
                    selection.addRange(range);
                }
            }
        };
        reader.readAsDataURL(file);
    };

    // 删除图片
    const removeImage = (id: string) => {
        setImages(prev => prev.filter(img => img.id !== id));
        updateContent();
    };

    // 获取当前内容（可用于表单提交）
    const getContent = () => {
        return {
            html: content,
            text: editableDivRef.current?.innerText || '',
            images
        };
    };

    // 示例：输出内容到控制台
    useEffect(() => {
        console.log('内容已更新:', getContent());
    }, [content, images]);

    return (
        <div className="container" suppressContentEditableWarning={true} style={{
            width: '80%',
            maxWidth: '600px',
            margin: '0 auto',
            fontFamily: 'Arial, sans-serif'
        }}>
            <div
                ref={editableDivRef}
                contentEditable
                className={`input-box ${isDragging ? 'dragging' : ''}`}
                style={{
                    width: '100%',
                    minHeight: '150px',
                    border: `1px solid ${isDragging ? '#4a90e2' : '#ccc'}`,
                    borderRadius: '8px',
                    padding: '15px',
                    backgroundColor: 'white',
                    boxShadow: isDragging
                        ? '0 0 0 2px rgba(74, 144, 226, 0.2)'
                        : '0 2px 10px rgba(0, 0, 0, 0.1)',
                    fontSize: '16px',
                    lineHeight: '1.5',
                    overflowY: 'auto',
                    wordBreak: 'break-all',
                    outline: 'none'
                }}
                onPaste={handlePaste}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onInput={updateContent}
            >
                {images.length === 0 && content === '' && (
                    <div style={{
                        color: '#999',
                        pointerEvents: 'none',
                        position: 'absolute',
                        marginTop: '-35px',
                        marginLeft: '15px'
                    }}>
                        在这里粘贴或拖入图片
                    </div>
                )}
            </div>

            <div style={{
                fontSize: '12px',
                color: '#666',
                marginTop: '5px'
            }}>
                支持截图粘贴和图片文件拖拽
            </div>

            {/* 图片预览区（可选） */}
            {images.length > 0 && (
                <div style={{ marginTop: '20px' }}>
                    <h4>已添加图片:</h4>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                        {images.map(img => (
                            <div key={img.id} style={{ position: 'relative' }}>
                                <img
                                    src={img.src}
                                    style={{
                                        width: '100px',
                                        height: '100px',
                                        objectFit: 'cover',
                                        borderRadius: '4px'
                                    }}
                                    alt="预览"
                                />
                                <button
                                    onClick={() => removeImage(img.id)}
                                    style={{
                                        position: 'absolute',
                                        top: '0',
                                        right: '0',
                                        backgroundColor: 'rgba(0,0,0,0.5)',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '50%',
                                        width: '20px',
                                        height: '20px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        justifyContent: 'center',
                                        alignItems: 'center'
                                    }}
                                >
                                    ×
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ImageInputBox;