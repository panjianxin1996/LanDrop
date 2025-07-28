# README

## About

This template comes with Vite, React, TypeScript, TailwindCSS and shadcn/ui.

Built with `Wails v2.5.1` and [shadcn's CLI](https://ui.shadcn.com/docs/cli)

### Using the Template
```console
wails init -n project-name -t https://github.com/Mahcks/wails-vite-react-tailwind-shadcnui-ts
```

```console
cd frontend
```

```console
npm install
```

### Installing Components
To install components, use shadcn's CLI tool to install

More info here: https://ui.shadcn.com/docs/cli#add

Example:
```console
npx shadcn-ui@latest add [component]
```

## Live Development

To run in live development mode, run `wails dev` in the project directory. In another terminal, go into the `frontend`
directory and run `npm run dev`. The frontend dev server will run on http://localhost:34115. Connect to this in your
browser and connect to your application.

## Fast Dev
```bash
wails dev -s
```

## Building

To build a redistributable, production mode package, use `wails build`.

## Build debug 
```bash
wails build -devtools
#Open app then keyboard [ctrl + shift + f12]
```
```
landrop启动了一个dns服务器，需要将landrop客户端的ip的地址作为其他客户端的dns服务器就可以通过landrop.go:4321访问到landrop服务。当客户端的电脑开启了ipv6的地址，并且ipv6 dns服务默认自动获取，那么会导致landrop.go解析失败，因为dns解析规则是先ipv6然后ipv4,所以客户端的ipv4和ipv6的ip地址都要作为客户端的dns服务器配置。
```

## Mac系统中systray和wails兼容冲突
mac系统不使用系统托盘工具，如果需要构建mac系统应用需要注释掉systray的代码
在mac系统所有操作都要使用sudo运行
```
sudo wails dev

sudo wails build
```