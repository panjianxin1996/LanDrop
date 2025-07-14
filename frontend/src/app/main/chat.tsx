import ChatBox from "@/components/common/chat-box"
import { useOutletContext } from 'react-router-dom';
export default function Team() {
  const { userId } = useOutletContext<{ userId: number }>();
    return (
    <div className="w-full h-full">
      <ChatBox userId={userId}/>
    </div>
  );
}