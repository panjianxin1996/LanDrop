import ChatBox from "@/components/common/chat-box"
import { useOutletContext } from 'react-router-dom';
export default function Team() {
  const { userId } = useOutletContext<{ userId: number }>();
    return (
    <div className="w-full h-[calc(100vh-3rem)]">
      <ChatBox userId={userId}/>
    </div>
  );
}