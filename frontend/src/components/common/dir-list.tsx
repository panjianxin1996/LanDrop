import * as React from "react"
import { List, LayoutGrid, Columns, Link, Trash2, Share2, Copy, RefreshCw, FolderOpen } from "lucide-react"
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
export default function DirList(props: { dirData: any }) {
    const [showType, setShowType] = React.useState("columns")
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
    const baseServer = 'http://127.0.0.1:4321/shared/'
    const changeShowType = (type: string) => {
        setShowType(type)
    }
    const getTxtFileData = (item: DirItem) => {
        fetch(baseServer + item.uri_name).then(res => res.text()).then(res => {
            setTxtFileData(res)
        })
    }
    const copyEvent = (text: string) => {
        navigator.clipboard.writeText(text).catch(err => console.error('复制失败:', err))
    }
    return (
        <ContextMenu>
            <ContextMenuTrigger className="relative">
                {/* <div className="relative"> */}
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
                                            <p className="overflow-hidden overflow-ellipsis line-clamp-2">{item.name}</p>
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
                            <div style={{ gridTemplateColumns: "repeat(auto-fit, minmax(5rem, 1fr))", transition: "all .2s ease-in" }} className={`overflow-auto ${showType === 'columns' ? 'w-1/2 border-r-2' : 'w-full'} grid auto-rows-min gap-2 px-2`}>
                                {
                                    props.dirData?.map((item: DirItem) => (
                                        <ContextMenu key={item.name}>
                                            <ContextMenuTrigger className="w-20 h-24 lg:h-32 px-2 py-4 flex flex-col items-center gap-1 cursor-pointer active:bg-gray-100 rounded-lg select-none" onClick={() => {
                                                setActiveFile(item)
                                                if (getFileType(item.name) === "code" || getFileType(item.name) === "txt") {
                                                    getTxtFileData(item)
                                                }
                                            }}>
                                                <img src={item.is_dir ? getImageUrl("file.png") : getFileIconUrl(item.name)} className="w-6 lg:w-10 h-6 lg:h-10" />
                                                <p className="overflow-hidden overflow-ellipsis line-clamp-2 text-xs text-center">{item.name}</p>
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
                                                <ContextMenuItem>
                                                    <Trash2 size={15} />
                                                    <span className="ml-2">删除文件</span>
                                                </ContextMenuItem>
                                            </ContextMenuContent>
                                        </ContextMenu>
                                    ))
                                }
                            </div>
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
                {/* </div> */}
            </ContextMenuTrigger>
            <ContextMenuContent>
                <ContextMenuItem onClick={() => { }}>
                    <RefreshCw size={15} />
                    <span className="ml-2">刷新</span>
                </ContextMenuItem>
                <ContextMenuItem onClick={() => { }}>
                    <FolderOpen size={15} />
                    <span className="ml-2">在资源管理器中打开</span>
                </ContextMenuItem>
            </ContextMenuContent>
        </ContextMenu>
    )
}