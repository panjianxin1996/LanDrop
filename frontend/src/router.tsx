import {
    BarChartIcon,
    FolderIcon,
    HelpCircleIcon,
    LayoutDashboardIcon,
    SearchIcon,
    SettingsIcon,
    UsersIcon,
} from "lucide-react"
import React, { Suspense, LazyExoticComponent } from "react"
import App from '@/App'
import AppWeb from '@/AppWeb'
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from "@/components/ui/sonner"

// 懒加载组件
export const LazyComponent = ({
    component: Component,
}: {
    component: LazyExoticComponent<() => JSX.Element>;
}) => (
    <Suspense >
        <Component />
    </Suspense>
);
// 客户端菜单路由上部分
export let navMain = [
    {
        title: "面板",
        path: "dashboard",
        icon: LayoutDashboardIcon,
        element: LazyComponent({
            component: React.lazy(() => import("@/app/dashboard")),
        })
    },
    {
        title: "工具",
        path: "tools",
        icon: BarChartIcon,
        element: LazyComponent({
            component: React.lazy(() => import("@/app/tools"))
        })
    },
    {
        title: "项目",
        path: "projects",
        icon: FolderIcon,
        element: LazyComponent({
            component: React.lazy(() => import("@/app/projects"))
        })
    },
    {
        title: "团队",
        path: "team",
        icon: UsersIcon,
        element: LazyComponent({
            component: React.lazy(() => import("@/app/team"))
        })
    },
]
// 客户端菜单路由下部分
export let navSecondary = [
    {
        title: "设置",
        path: "settings",
        icon: SettingsIcon,
        element: LazyComponent({
            component: React.lazy(() => import("@/app/settings"))
        })
    },
    {
        title: "获取帮助",
        path: "help",
        icon: HelpCircleIcon,
        element: LazyComponent({
            component: React.lazy(() => import("@/app/help"))
        })
    },
    {
        title: "搜索",
        path: "search",
        icon: SearchIcon,
        element: LazyComponent({
            component: React.lazy(() => import("@/app/search"))
        })
    },
]

export const otherRouter = [
    {
        title: "当前分享",
        path: "shared",
        element: LazyComponent({
            component: React.lazy(() => import("@/app/shared"))
        })
    },
]

// 主路由
export const appRouter = [
    {
        path: "/",
        element: <Navigate to="/client" replace />,
    },
    {
        path: "/client",
        element: <App />,
        children: [{
            path: "/client",
            element: <Navigate to="/client/dashboard" replace />,
        }, ...navMain, ...navSecondary, ...otherRouter],
    },
    {
        path: "/web",
        element: <AppWeb />,
    },
    {
        path: "/testweb",
        element: <AppWeb />,
    },
]

// 路由组件
export const AppRouterComponent = () => (
    <>
        {/* sonner toast 弹框容器 */}
        <Toaster richColors />
        <Router>
            <Routes>
                {appRouter.map(route => (
                    // 主路由
                    <Route key={route.path} path={route.path} element={route.element}>
                        {/* 子路由 */}
                        {route.children?.map(child => (
                            <Route
                                key={child.path}
                                path={child.path}
                                element={child.element}
                            />
                        ))}
                    </Route>
                ))}
            </Routes>
        </Router>
    </>
)


export const menuRouter = [...navMain, ...navSecondary, ...otherRouter]
export default {
    menuRouter,
    appRouter,
    AppRouterComponent,
    LazyComponent,
    navMain,
    navSecondary

}