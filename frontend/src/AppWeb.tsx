import { SidebarProvider } from "@/components/ui/sidebar"

// const Settings = React.lazy(() => import('./pages/settings'));
export default function AppWev() {
    return (
        <SidebarProvider>
            <div>web app
                <form className="upload-form"
                    action="http://localhost:4321/api/v1/uploadFile"
                    method="POST"
                    encType="multipart/form-data">
                    <div>
                        <label>选择文件：</label>
                        <input type="file" id="fileInput" name="file" required />
                    </div>
                    <div>
                        <label>描述（可选）：</label>
                        <input type="text" id="description" name="description" />
                    </div>
                    <button type="submit">上传文件</button>
                </form>
            </div>
        </SidebarProvider>
    )
}