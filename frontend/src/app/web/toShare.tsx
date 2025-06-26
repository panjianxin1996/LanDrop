import FileUpload from "@/components/common/upload-file"
export default function ToShare() {
    return <>
    <FileUpload uploadUrl="/api/v1/uploadFile" />
    </>
}