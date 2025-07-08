import ChatBox from "@/components/common/chat-box"
import useClientStore from "@/store/appStore";
export default function Team() {
  const { userInfo } = useClientStore()
    return (
    <div className="w-full h-[calc(100vh-4rem)]">
      <ChatBox userId={+userInfo.userId}/>
    </div>
  );
}