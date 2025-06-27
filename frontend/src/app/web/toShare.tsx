import FileUpload from "@/components/common/upload-file"
export default function ToShare() {
    return <div className="w-full pt-16">
        <FileUpload uploadUrl="/api/v1/uploadFile" />
    </div>
}