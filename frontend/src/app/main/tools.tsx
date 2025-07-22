import { ToolsParseToken } from "@clientSDK/App"
import {Textarea} from "@/components/ui/textarea"
import {Button} from "@/components/ui/button"
import { useState } from "react"
export default function Tools() {
  const [parseStr, setParseStr] = useState<string>("")
  const parseToken = () => {
    ToolsParseToken(parseStr).then((res:any)=> {
      console.log(res)
    })
  }
  return (
    <div className="flex flex-col items-center justify-center p-4">
      <Textarea onChange={(e) => setParseStr(e.target.value)}></Textarea>
      <Button onClick={()=> parseToken()}>解析</Button>
    </div>
  )
}