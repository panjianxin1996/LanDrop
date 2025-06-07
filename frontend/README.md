# LanDrop前端
如何调用客户端方法？
```typeScript
import { OpenDirInExplorer } from "@clientSDK/App"

OpenDirInExplorer("C:\\Users\\Administrator\\Desktop\\test").then(res=>{console.log(res)})
```