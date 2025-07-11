import FileUpload from "@/components/common/upload-file"
export default function ToShare() {
    return <div className="w-full sm:pl-20 pt-16 sm:pt-4">
        <FileUpload uploadUrl="/api/v1/uploadFile" />
    </div>
}