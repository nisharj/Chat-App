import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

import api from "../services/api";
import useChatStore from "../store/useChatStore";

import Sidebar from "../features/home/components/Sidebar";
import ChatPanel from "../features/home/components/ChatPanel";

import useRoomDirectory from "../features/home/hooks/useRoomDirectory";
import useChatSession from "../features/home/hooks/useChatSesssion";

function RoomChatPanel({
  user,
  token,
  activeRoom,
  messages,
  setMessages,
  addMessage,
}) {
  const chatSession = useChatSession({
    user,
    token,
    activeRoom,
    messages,
    setMessages,
    addMessage,
  });

  return (
    <ChatPanel
      user={user}
      activeRoom={activeRoom}
      messages={messages}
      messagesEndRef={chatSession.messagesEndRef}
      typingLabel={chatSession.typingLabel}
      input={chatSession.input}
      onInputChange={chatSession.handleInputChange}
      onSend={chatSession.sendCurrentMessage}
      selectedFile={chatSession.selectedFile}
      fileCaption={chatSession.fileCaption}
      uploadError={chatSession.uploadError}
      isUploading={chatSession.isUploading}
      onFileSelect={chatSession.handleFileSelect}
      onFileCaptionChange={chatSession.setFileCaption}
      onRemoveFile={chatSession.removeSelectedFile}
      onUploadFile={chatSession.uploadSelectedFile}
    />
  );
}

export default function Home() {
  const {
    user,
    token,
    logout,
    rooms,
    setRooms,
    activeRoom,
    setActiveRoom,
    messages,
    setMessages,
    addMessage,
  } = useChatStore();

  const navigate = useNavigate();

  const roomDirectory = useRoomDirectory({
    user,
    rooms,
    activeRoom,
    setRooms,
    setActiveRoom,
    setMessages,
  });

  useEffect(() => {
    if (!user) return;

    const ping = () =>
      api
        .post(`/api/presence/online?username=${user.username}`)
        .catch(() => {});

    ping();

    const interval = setInterval(ping, 20000);

    return () => clearInterval(interval);
  }, [user]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="flex h-screen bg-gray-100 text-gray-900">
      <Sidebar
        user={user}
        activeRoom={activeRoom}
        onSelectRoom={setActiveRoom}
        onLogout={handleLogout}
        onCreateRoom={roomDirectory.createRoom}
        onDeleteRoom={roomDirectory.deleteRoom}
        onOpenDirectMessage={roomDirectory.openDirectMessage}
        {...roomDirectory}
      />

      <RoomChatPanel
        key={activeRoom?.id ?? "no-room"}
        user={user}
        token={token}
        activeRoom={activeRoom}
        messages={messages}
        setMessages={setMessages}
        addMessage={addMessage}
      />
    </div>
  );
}
