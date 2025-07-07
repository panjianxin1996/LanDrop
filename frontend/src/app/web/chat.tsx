import ChatBox from "@/components/common/chat-box"
import { useOutletContext } from 'react-router-dom';
export default function Chat() {
    const { userId } = useOutletContext<{ userId: number }>();
    console.log(userId, "userId")
    return <div className="w-full h-full p-0 sm:pl-20 pt-16 sm:pt-0 border-t-[1px]">
    <ChatBox userId={userId}/>
</div>
}