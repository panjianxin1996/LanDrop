import * as React from "react"
import { List, LayoutGrid, Columns, Link, Trash2, Share2, Copy, RefreshCw, FolderOpen, CircleEllipsis } from "lucide-react"
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
import useClientStore from "@/store/appStore"
import { useApiRequest } from "@/tools/request"
import { toast } from "sonner"

export interface DirItem {
    name: string
    size: number
    mode: string
    is_dir: string
    mod_time: string
    uri_name: string
    path: string
    file_id: string
}
export default function DirList(props: { dirData: any, sharedDir: string, reload: () => void }) {
    const { isClient } = useClientStore()
    const { baseHost } = useApiRequest()
    const [showType, setShowType] = React.useState("card")
    const [activeFile, setActiveFile] = React.useState<DirItem>({
        name: '',
        size: 0,
        mode: '',
        is_dir: '',
        mod_time: '',
        path: '',
        file_id: '',
        uri_name: ''
    })
    const [txtFileData, setTxtFileData] = React.useState<string>('')
    const [openDialog, setOpenDialog] = React.useState(false)
    const [fileInfo, setFileInfo] = React.useState<any>({})
    const baseServer = baseHost + '/shared/'
    const changeShowType = (type: string) => {
        setShowType(type)
    }
    const getTxtFileData = (item: DirItem) => {
        fetch(baseServer + item.uri_name).then(res => res.text()).then(res => {
            setTxtFileData(res)
        })
    }
    const copyEvent = (text: string) => {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(text).catch(err => console.error('复制失败:', err))
            toast("进入navigator.clipboard.writeText")
        } else { // 安全策略http不允许navigator.clipboard复制操作
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.id = 'textarea'
            textarea.style.position = 'fixed';
            document.body.appendChild(textarea);
            textarea.select();
            setTimeout(() => {
                const res = document.execCommand('copy');
                toast(`进入document.execCommand${res}`)
            }, 5000);
            
            // textarea.remove();
            
        }
    }

    const openDirInExplorer = () => {
        OpenDirInExplorer(props.sharedDir).then(res => {
            console.log(res, '打开目录成功回调')
        })
    }
    return (
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
                            showType === 'list' && <Table>
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
                                    {props.dirData?.map((item: DirItem) => (
                                        <TableRow key={item.name}>
                                            <TableCell className="font-medium text-xs flex p-2">
                                                <img src={item.is_dir ? getImageUrl("file.png") : getFileIconUrl(item.name)} className="w-6 h-6 mr-4" />
                                                <Tooltip> {/* 文件名超长显示提示框 */}
                                                    <TooltipTrigger asChild>
                                                        <p className="overflow-hidden overflow-ellipsis line-clamp-2">{item.name}</p>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        <p className="max-w-sm">{item.name}</p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TableCell>
                                            <TableCell className="text-xs p-2">{item.is_dir ? '文件夹' : getFileType(item.name)}</TableCell>
                                            <TableCell className="text-xs p-2">{item.is_dir ? '-' : autoUnitCalc(item.size).Unit}</TableCell>
                                            <TableCell className="text-xs p-2">{dayjs(item.mod_time).format("YYYY-MM-DD HH:mm:ss")}</TableCell>
                                            <TableCell className="text-xs p-2">{item.mode}</TableCell>
                                            <TableCell className="text-xs p-2">{item.is_dir ? '是' : '否'}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        }
                        {// 卡片模式
                            showType !== 'list' && <>
                                <div style={{ transition: "all .2s ease-in" }} className={`overflow-auto ${showType === 'columns' ? 'w-1/2 border-r-2' : 'w-full'} flex flex-wrap gap-2 px-2`}>
                                    {
                                        props.dirData?.map((item: DirItem) => (
                                            <ContextMenu key={item.name}>
                                                <ContextMenuTrigger asChild>
                                                    <div className="w-20 max-h-24 lg:max-h-28 lg:h-32 px-1 py-2 flex flex-col items-center gap-1 cursor-pointer active:bg-gray-100 rounded-lg select-none" onClick={() => {
                                                        setActiveFile(item)
                                                        if (getFileType(item.name) === "code" || getFileType(item.name) === "txt") {
                                                            getTxtFileData(item)
                                                        }
                                                    }}>
                                                        <img src={item.is_dir ? getImageUrl("file.png") : getFileIconUrl(item.name)} className="w-8 lg:w-12 h-8 lg:h-12" />
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <p className="w-full overflow-hidden text-ellipsis line-clamp-2 [-webkit-line-clamp:2] [-webkit-box-orient:vertical] [display:-webkit-box] text-xs text-center break-words">
                                                                    {item.name}
                                                                </p>
                                                            </TooltipTrigger>
                                                            <TooltipContent>
                                                                <p className="max-w-sm">{item.name}</p>
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    </div>
                                                </ContextMenuTrigger>
                                                <ContextMenuContent>
                                                    <ContextMenuItem onClick={() => copyEvent(item.name)}>
                                                        <Copy size={15} />
                                                        <span className="ml-2">复制文件名</span>
                                                    </ContextMenuItem>
                                                    <ContextMenuItem onClick={() => copyEvent(baseServer + item.uri_name)}>
                                                        <Link size={15} />
                                                        <span className="ml-2">文件链接</span>
                                                    </ContextMenuItem>
                                                    <ContextMenuItem onClick={() => copyEvent(item.file_id)}>
                                                        <Share2 size={15} />
                                                        <span className="ml-2">分享码</span>
                                                    </ContextMenuItem>
                                                    {
                                                        isClient && <ContextMenuItem>
                                                            <Trash2 size={15} />
                                                            <span className="ml-2">删除文件</span>
                                                        </ContextMenuItem>
                                                    }
                                                    <ContextMenuItem onClick={() => { setFileInfo(item); setOpenDialog(true); }}>
                                                        <CircleEllipsis size={15} />
                                                        <span className="ml-2">文件属性</span>
                                                    </ContextMenuItem>
                                                </ContextMenuContent>
                                            </ContextMenu>
                                        ))
                                    }
                                </div>
                                <Dialog open={openDialog} onOpenChange={setOpenDialog}>
                                    <DialogContent>
                                        <DialogHeader>
                                            <DialogTitle>文件详情</DialogTitle>
                                            <DialogDescription>
                                                <div className="grid grid-cols-2 gap-2 mt-4">
                                                    <div>文件名</div>
                                                    <div className="overflow-hidden overflow-ellipsis line-clamp-2">{fileInfo.name}</div>
                                                    <div>类型</div>
                                                    <div>{fileInfo.is_dir ? '文件夹' : getFileType(fileInfo.name)}</div>
                                                    <div>大小</div>
                                                    <div>{fileInfo.is_dir ? '-' : autoUnitCalc(fileInfo.size).Unit}</div>
                                                    <div>修改时间</div>
                                                    <div>{dayjs(fileInfo.mod_time).format("YYYY-MM-DD HH:mm:ss")}</div>
                                                    <div>权限</div>
                                                    <div>{fileInfo.mode}</div>
                                                    <div>是否文件夹</div>
                                                    <div>{fileInfo.is_dir ? '是' : '否'}</div>
                                                </div>
                                            </DialogDescription>
                                        </DialogHeader>
                                        <DialogFooter>
                                            <Button onClick={() => setOpenDialog(false)}>关闭</Button>
                                        </DialogFooter>
                                    </DialogContent>
                                </Dialog>
                                <div className={`${showType === 'columns' ? 'w-1/2 p-4' : 'w-0'} box-border flex flex-col items-center transition-all relative `}>
                                    {showType === 'columns' && <>
                                        <p className="pb-2">预览</p>
                                        { // 图片预览
                                            activeFile.name && getFileType(activeFile.name) === 'picture' && <img src={baseServer + activeFile.uri_name} style={{ height: "50%" }} />
                                        }
                                        { // 视频预览
                                            getFileType(activeFile.name) === 'video' && <video src={baseServer + activeFile.uri_name} controls>
                                                您的浏览器不支持视频播放
                                            </video>
                                        }
                                        <pre className="w-full overflow-auto">
                                            { // 文字预览
                                                (getFileType(activeFile.name) === 'txt' || getFileType(activeFile.name) === 'code') && txtFileData
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
    )
}