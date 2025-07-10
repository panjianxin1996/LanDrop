import ChatBox from "@/components/common/chat-box"
import { useOutletContext } from 'react-router-dom';
export default function Team() {
  const { userId, socketData } = useOutletContext<{ userId: number, socketData:any }>();
    return (
    <div className="w-full h-[calc(100vh-4rem)]">
      <ChatBox userId={userId} socketData={socketData}/>
    </div>
  );
}