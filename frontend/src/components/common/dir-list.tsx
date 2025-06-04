import * as React from "react"
import { List, LayoutGrid, Columns } from "lucide-react"
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

export interface DirItem {
    name: string
    uriName: string
    size: number
    mode: string
    is_dir: string
    mod_time: string
}
export default function DirList(props: { dirData: any }) {
    const [showType, setShowType] = React.useState("columns")
    const [activeFile, setActiveFile] = React.useState<DirItem>({
        name: '',
        uriName: '',
        size: 0,
        mode: '',
        is_dir: '',
        mod_time: ''
    })
    const baseServer = 'http://127.0.0.1:4321/shared/'
    const changeShowType = (type: string) => {
        setShowType(type)
    }
    const getTxtFileData = () => {
        fetch(baseServer + activeFile.uriName).then(res=> res.text()).then(res=> {
            console.log(res,'========')
        })
        return 111
    }
    return (<div className="relative">
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
                    <div className={`overflow-auto ${showType === 'columns' ? 'w-1/2 grid-cols-4 border-r-2' : 'w-full grid-cols-8'} grid auto-rows-min gap-2 px-2`}>
                        {
                            props.dirData?.map((item: DirItem) => (
                                <div className="w-20 h-24 lg:h-32 px-2 py-4 flex flex-col items-center gap-1 cursor-pointer active:bg-gray-100 rounded-lg select-none" key={item.name} onClick={() => {
                                    setActiveFile(item)
                                }}>
                                    <img src={item.is_dir ? getImageUrl("file.png") : getFileIconUrl(item.name)} className="w-6 lg:w-10 h-6 lg:h-10" />
                                    <p className="overflow-hidden overflow-ellipsis line-clamp-2 text-xs text-center">{item.name}</p>
                                </div>
                            ))
                        }
                    </div>
                    <div className={`${showType === 'columns' ? 'w-1/2 p-4' : 'w-0'} box-border pr-0 flex flex-col items-center transition-all`}>
                        {showType === 'columns' && <>
                            <p>预览</p>
                            { // 图片预览
                                activeFile.name && getFileType(activeFile.name) === 'picture' && <img src={baseServer + activeFile.uriName} style={{ height: "50%" }} />
                            }
                            { // 视频预览
                                activeFile.name && getFileType(activeFile.name) === 'video' && <video src={baseServer + activeFile.uriName} controls>
                                    您的浏览器不支持视频播放
                                </video>
                            }
                            { // 文字预览
                                activeFile.name && getFileType(activeFile.name) === 'txt' && getTxtFileData()
                            }
                            { // 文字预览
                                activeFile.name && getFileType(activeFile.name) === 'code' && getTxtFileData()
                            }
                        </>}
                    </div>
                </>
            }
        </div>
    </div>)
}