import * as React from "react"
import { List, LayoutGrid, Columns, Link, Trash2, Share2, Copy, RefreshCw, FolderOpen, CircleEllipsis, MonitorDown, BookOpen } from "lucide-react"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import dayjs from "dayjs";
import { autoUnitCalc, getImageUrl, getFileIconUrl, getFileType } from "@/tools/tool";
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuTrigger,
} from "@/components/ui/context-menu"
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter
} from "@/components/ui/dialog"
import {
    Button,
} from "@/components/ui/button"
import { OpenDirInExplorer } from "@clientSDK/App"
import useStore from "@/store/appStore"
import { useApiRequest } from "@/tools/request"
import { toast } from "sonner"

export interface DirItem {
    fileName: string
    fileSize: number
    fileMode: string
    isDir: string
    fileModTime: string
    uriName: string
    path: string
    fileCode: string
}
export default function DirList(props: { dirData: any, sharedDir: string, className?: string, reload: () => void }) {
    const { isClient } = useStore()
    const { baseHost } = useApiRequest()
    const [showType, setShowType] = React.useState("card")
    const [activeFile, setActiveFile] = React.useState<DirItem>({
        fileName: '',
        fileSize: 0,
        fileMode: '',
        isDir: '',
        fileModTime: '',
        path: '',
        fileCode: '',
        uriName: ''
    })
    const [txtFileData, setTxtFileData] = React.useState<string>('')
    const [openDialog, setOpenDialog] = React.useState(false)
    const [fileInfo, setFileInfo] = React.useState<any>({})
    const baseServer = baseHost + '/shared/'
    const changeShowType = (type: string) => {
        setShowType(type)
    }
    const getTxtFileData = (item: DirItem) => {
        fetch(baseServer + item.uriName).then(res => res.text()).then(res => {
            setTxtFileData(res)
        })
    }
    const copyEvent = (text: string) => {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(text).catch(err => console.error('复制失败:', err))
        } else { // 安全策略http不允许navigator.clipboard复制操作
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.id = 'textarea'
            textarea.style.position = 'fixed';
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            textarea.remove();
        }
        toast.success("复制成功")
    }

    const openDirInExplorer = () => {
        OpenDirInExplorer(props.sharedDir).then(res => {
            console.log(res, '打开目录成功回调')
        })
    }

    const downloadEvent = (uri_name: string) => {
        window.open(baseServer + uri_name)
    }
    return (
        <div className={props.className}>
            <ContextMenu>
                <ContextMenuTrigger asChild>
                    <div className="relative">
                        <div className="absolute top-0 right-4 w-full flex justify-between py-2">
                            <div></div>
                            <ToggleGroup value={showType} type="single" onValueChange={(type) => changeShowType(type)}>
                                <ToggleGroupItem value="columns"><Columns size={15} /></ToggleGroupItem>
                                <ToggleGroupItem value="card"><LayoutGrid size={15} /></ToggleGroupItem>
                                <ToggleGroupItem value="list"><List size={15} /></ToggleGroupItem>
                            </ToggleGroup>
                        </div>
                        <div className="pt-14 flex h-full justify-between" style={{ height: "80vh" }}>
                            {/* 列表模式 */
                                showType === 'list' && <Table className="relative">
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[250px] text-xs">文件名</TableHead>
                                            <TableHead className="text-xs">类型</TableHead>
                                            <TableHead className="text-xs">大小</TableHead>
                                            <TableHead className="text-xs">修改时间</TableHead>
                                            <TableHead className="text-xs">权限</TableHead>
                                            <TableHead className="text-xs">文件夹</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {
                                            (!props.dirData || props.dirData.length === 0) && <p className="absolute w-full flex justify-center items-center text-gray-500 text-xs top-24">
                                                <BookOpen size={15} />
                                                <span className="ml-2">当前分享目录下没有文件</span>
                                            </p>
                                        }
                                        {props.dirData?.map((item: DirItem) => (
                                            <TableRow key={item.fileName}>
                                                <TableCell className="font-medium text-xs flex p-2">
                                                    <img src={item.isDir ? getImageUrl("file.png") : getFileIconUrl(item.fileName)} className="w-6 h-6 mr-4" />
                                                    <Tooltip> {/* 文件名超长显示提示框 */}
                                                        <TooltipTrigger asChild>
                                                            <p className="overflow-hidden overflow-ellipsis line-clamp-2">{item.fileName}</p>
                                                        </TooltipTrigger>
                                                        <TooltipContent>
                                                            <p className="max-w-sm">{item.fileName}</p>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </TableCell>
                                                <TableCell className="text-xs p-2">{item.isDir ? '文件夹' : getFileType(item.fileName)}</TableCell>
                                                <TableCell className="text-xs p-2">{item.isDir ? '-' : autoUnitCalc(item.fileSize).Unit}</TableCell>
                                                <TableCell className="text-xs p-2">{dayjs(item.fileModTime).format("YYYY-MM-DD HH:mm:ss")}</TableCell>
                                                <TableCell className="text-xs p-2">{item.fileMode}</TableCell>
                                                <TableCell className="text-xs p-2">{item.isDir ? '是' : '否'}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            }
                            {// 卡片模式
                                showType !== 'list' && <>
                                    <div onTouchEnd={e=> (e.stopPropagation())} style={{ transition: "all .2s ease-in", borderRightWidth: showType === 'columns' ? '1px' : '0px' }} className={`overflow-auto ${showType === 'columns' ? 'w-3/5' : 'w-full'} flex flex-wrap content-start gap-2 px-2`}>
                                        {
                                            props.dirData?.map((item: DirItem) => (
                                                <ContextMenu key={item.fileName}>
                                                    <ContextMenuTrigger asChild>
                                                        <div className="w-20 max-h-24 lg:max-h-28 lg:h-32 px-1 py-2 flex flex-col items-center gap-1 cursor-pointer active:bg-gray-100 rounded-lg select-none" onClick={() => {
                                                            setActiveFile(item)
                                                            if (getFileType(item.fileName) === "code" || getFileType(item.fileName) === "txt") {
                                                                getTxtFileData(item)
                                                            }
                                                        }}>
                                                            <img src={item.isDir ? getImageUrl("file.png") : getFileIconUrl(item.fileName)} className="w-8 lg:w-12 h-8 lg:h-12" />
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <p className="w-full overflow-hidden text-ellipsis line-clamp-2 [-webkit-line-clamp:2] [-webkit-box-orient:vertical] [display:-webkit-box] text-xs text-center break-words">
                                                                        {item.fileName}
                                                                    </p>
                                                                </TooltipTrigger>
                                                                <TooltipContent>
                                                                    <p className="max-w-sm">{item.fileName}</p>
                                                                </TooltipContent>
                                                            </Tooltip>
                                                        </div>
                                                    </ContextMenuTrigger>
                                                    <ContextMenuContent>
                                                        {
                                                            isClient && <>
                                                                <ContextMenuItem onClick={() => copyEvent(item.fileName)}>
                                                                    <Copy size={15} />
                                                                    <span className="ml-2">复制文件名</span>
                                                                </ContextMenuItem>
                                                                <ContextMenuItem onClick={() => copyEvent(baseServer + item.uriName)}>
                                                                    <Link size={15} />
                                                                    <span className="ml-2">文件链接</span>
                                                                </ContextMenuItem>
                                                                <ContextMenuItem onClick={() => copyEvent(item.fileCode)}>
                                                                    <Share2 size={15} />
                                                                    <span className="ml-2">分享码</span>
                                                                </ContextMenuItem>
                                                                <ContextMenuItem>
                                                                    <Trash2 size={15} />
                                                                    <span className="ml-2">删除文件</span>
                                                                </ContextMenuItem>
                                                            </>
                                                        }
                                                        {
                                                            !isClient && <>
                                                                <ContextMenuItem onClick={() => downloadEvent(item.uriName)}>
                                                                    <MonitorDown size={15} />
                                                                    <span className="ml-2">下载</span>
                                                                </ContextMenuItem>
                                                            </>
                                                        }
                                                        <ContextMenuItem onClick={() => { setFileInfo(item); setOpenDialog(true); }}>
                                                            <CircleEllipsis size={15} />
                                                            <span className="ml-2">文件属性</span>
                                                        </ContextMenuItem>
                                                    </ContextMenuContent>
                                                </ContextMenu>
                                            ))
                                        }
                                        {
                                            (!props.dirData || props.dirData.length === 0) && <p className="w-full flex justify-center items-center text-gray-500 text-xs pt-24">
                                                <BookOpen size={15} />
                                                <span className="ml-2">当前分享目录下没有文件</span>
                                            </p>
                                        }
                                    </div>
                                    <Dialog open={openDialog} onOpenChange={setOpenDialog}>
                                        <DialogContent>
                                            <DialogHeader>
                                                <DialogTitle>文件详情</DialogTitle>
                                                <DialogDescription asChild>
                                                    <div className="grid grid-cols-2 gap-2 mt-4">
                                                        <div>文件名</div>
                                                        <div className="overflow-hidden overflow-ellipsis line-clamp-2">{fileInfo.fileName}</div>
                                                        <div>类型</div>
                                                        <div>{fileInfo.is_dir ? '文件夹' : getFileType(fileInfo.fileName)}</div>
                                                        <div>大小</div>
                                                        <div>{fileInfo.is_dir ? '-' : autoUnitCalc(fileInfo.fileSize).Unit}</div>
                                                        <div>修改时间</div>
                                                        <div>{dayjs(fileInfo.fileModTime).format("YYYY-MM-DD HH:mm:ss")}</div>
                                                        <div>权限</div>
                                                        <div>{fileInfo.fileMode}</div>
                                                        <div>是否文件夹</div>
                                                        <div>{fileInfo.isDir ? '是' : '否'}</div>
                                                    </div>
                                                </DialogDescription>
                                            </DialogHeader>
                                            <DialogFooter>
                                                <Button onClick={() => setOpenDialog(false)}>关闭</Button>
                                            </DialogFooter>
                                        </DialogContent>
                                    </Dialog>
                                    {/* 文件预览 目前支持图片 视频 纯文本 */}
                                    <div className={`${showType === 'columns' ? 'w-2/5 p-4' : 'w-0'} box-border flex flex-col items-center transition-all relative `}>
                                        {showType === 'columns' && <>
                                            <p className="pb-2">预览</p>
                                            { // 图片预览
                                                activeFile.fileName && getFileType(activeFile.fileName) === 'picture' && <img src={baseServer + activeFile.uriName} style={{ height: "50%" }} />
                                            }
                                            { // 视频预览
                                                getFileType(activeFile.fileName) === 'video' && <video src={baseServer + activeFile.uriName} controls>
                                                    您的浏览器不支持视频播放
                                                </video>
                                            }
                                            <pre className="w-full overflow-auto">
                                                { // 文字预览
                                                    (getFileType(activeFile.fileName) === 'txt' || getFileType(activeFile.fileName) === 'code') && txtFileData
                                                }
                                            </pre>
                                        </>}
                                    </div>
                                </>
                            }
                        </div>
                    </div>
                </ContextMenuTrigger>
                <ContextMenuContent>
                    <ContextMenuItem onClick={() => props.reload()}>
                        <RefreshCw size={15} />
                        <span className="ml-2">刷新</span>
                    </ContextMenuItem>
                    {
                        isClient && <ContextMenuItem onClick={() => openDirInExplorer()}>
                            <FolderOpen size={15} />
                            <span className="ml-2">在资源管理器中打开</span>
                        </ContextMenuItem>
                    }
                </ContextMenuContent>
            </ContextMenu>
        </div>
    )
}