import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { FormEvent, useState } from "react"
type AppLoginFormProps = {
    className?: string,
    loginEvent?: (adminId: string,adminPwd: string) => void, // 添加自定义属性
}
export function AppLoginForm({
    className,
    loginEvent
}: AppLoginFormProps) {
    // 使用状态管理表单数据
    const [formData, setFormData] = useState({
        userName: "",
        password: ""
    });

    // 处理输入变化
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { id, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [id]: value
        }));
    };

    // 处理表单提交
    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        appLogin(); // 调用登录函数
    };

    const appLogin = () => {
        loginEvent?.(formData.userName, formData.password)
    };

    return (
        <div className={cn("flex flex-col gap-6", className)}>
            <Card>
                <CardHeader>
                    <CardTitle className="text-xl">切换管理员账号</CardTitle>
                    <CardDescription>
                        更换管理员账号可以获取更高权限
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {/* 添加 onSubmit 事件处理 */}
                    <form onSubmit={handleSubmit}>
                        <div className="flex flex-col gap-6">
                            <div className="grid gap-3">
                                <Label htmlFor="userName">管理员（账号ID/账号名称）</Label>
                                <Input
                                    id="userName"
                                    type="text"
                                    value={formData.userName}
                                    onChange={handleInputChange}
                                    required
                                />
                            </div>
                            <div className="grid gap-3">
                                <div className="flex items-center">
                                    <Label htmlFor="password">管理员密码</Label>
                                    <a href="#" className="ml-auto inline-block text-sm underline-offset-4 hover:underline">忘记密码？</a>
                                </div>
                                <Input
                                    id="password"
                                    type="password"
                                    value={formData.password}
                                    onChange={handleInputChange}
                                    required
                                />
                            </div>
                            <div className="flex flex-col gap-3">
                                {/* 将按钮类型改为 submit */}
                                <Button type="submit" className="w-full">登录</Button>
                            </div>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}