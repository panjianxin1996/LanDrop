# LanDrop前端
如何调用客户端方法？
```typeScript
import { OpenDirInExplorer } from "@clientSDK/App"

OpenDirInExplorer("C:\\Users\\Administrator\\Desktop\\test").then(res=>{console.log(res)})
```

### Node.js 22.x.x版本会导致内存泄漏问题，目前排查22版本全都有泄露问题，推荐使用18.19.0 或者24.1.0
```
npm ls inflight
landrop@1.0.0 I:\go\src\LanDrop\frontend
├─┬ eslint@8.43.0
│ └─┬ file-entry-cache@6.0.1
│   └─┬ flat-cache@3.0.4
│     └─┬ rimraf@3.0.2
│       └─┬ glob@7.2.3
│         └── inflight@1.0.6 deduped
└─┬ tailwindcss@3.3.2
  └─┬ sucrase@3.32.0
    └─┬ glob@7.1.6
      └── inflight@1.0.6
```
`Deepseak`排查可能是这个库导致的
> 内存泄漏风险：inflight@1.0.6 在 Node.js 22.13.0 及更早版本中被报告存在内存泄漏问题，尤其是在通过 glob@7.2.3 等依赖间接引入时，可能导致未释放的请求句柄堆积。
官方建议：Node.js 社区推荐替换为更稳定的替代方案（如 lru-cache），而非依赖废弃的 inflight 模块。

添加了useConsole组件，但是需要注意的是当useConsole监听的时候，组件内的console和request必须要放在useEffect中，不然会出现死循环问题，因为useConsole会直接监听console，然后会重新渲染App组件，导致内部所有组件重新渲染，然后就出现了整个页面死循环问题。todo: 待解决这个问题。