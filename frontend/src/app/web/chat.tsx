import ChatBox from "@/components/common/chat-box"
import { useOutletContext } from 'react-router-dom';
export default function Chat() {
    const { userId } = useOutletContext<{ userId: number }>();
    return <div className="w-full h-full p-0 sm:pl-20 border-t-[1px]">
    <ChatBox userId={userId}/>
</div>
}