import ChatTextArea, {type ChatTextAreaRef} from "@/components/common/chatTextArea"
import { useEffect, useRef } from "react"
import { useApiRequest } from '@/tools/request'
export default function Help() {
  const TextArea = useRef<ChatTextAreaRef>(null)
  const {upload} = useApiRequest()
  useEffect(() => {
    console.log(TextArea.current?.getFiles(), "===")
  }, [])
  const test = ()=> {
    console.log(TextArea.current?.getInput())
    console.log(TextArea.current?.getFiles())
   if (!TextArea.current) return;
  
  const files = TextArea.current.getFiles();
  console.log('Files to upload:', files); // 调试输出

  if (files.length === 0) {
    
    return;
  }

  upload("/uploadChatFiles", files)
    .then(() => TextArea.current?.clear())
    .catch(error => console.error('Upload failed:', error))
  }
  return (
    <div className="flex flex-col items-start justify-center p-4">
      <h1 className="text-xl text-weight pb-4">快捷问答</h1>
      <div className="text-sm">问：如何使用LanDrop？</div>
      <div className="pb-4 text-sm">答：运行<code className="bg-slate-200 px-1 rounded-sm">LanDrop</code>可执行文件即可启动文件共享服务。LanDrop会在本地创建一个服务，同一个局域网内设备可以通过你的局域网ip:4321访问。</div>
      <div className="text-sm">问：我能切换分享的目录文件夹吗？</div>
      <div className="pb-4 text-sm">答：可以的，你可以在客户端的设置中设置需要分享的文件夹。</div>
      <div className="text-sm">问：我只想分享一个文件，并且短期有效该怎么办？</div>
      <div className="pb-4 text-sm">答：客户端快速分享，选择需要分享的文件，并且设置分享的时效。</div>
      <ChatTextArea ref={TextArea}/>
      <button onClick={()=> test()}>test</button>
    </div>
  )
}