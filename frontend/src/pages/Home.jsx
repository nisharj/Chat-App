import { useEffect, useState } from "react";
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
  onOpenSidebar,
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
      onOpenSidebar={onOpenSidebar}
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
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

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

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 1024px)");
    const handleChange = (event) => {
      if (event.matches) {
        setIsSidebarOpen(false);
      }
    };

    mediaQuery.addEventListener("change", handleChange);

    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, []);

  useEffect(() => {
    if (!isSidebarOpen) return undefined;

    if (window.matchMedia("(min-width: 1024px)").matches) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsSidebarOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isSidebarOpen]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const handleOpenSidebar = () => setIsSidebarOpen(true);
  const handleCloseSidebar = () => setIsSidebarOpen(false);
  const handleSelectRoom = (room) => {
    setActiveRoom(room);
    handleCloseSidebar();
  };
  const handleOpenDirectMessage = (username) => {
    roomDirectory.openDirectMessage(username);
    handleCloseSidebar();
  };

  return (
    <div className="flex h-dvh overflow-hidden bg-gray-100 text-gray-900">
      <button
        type="button"
        onClick={handleCloseSidebar}
        aria-label="Close sidebar"
        className={`fixed inset-0 z-30 bg-slate-950/40 transition-opacity duration-300 lg:hidden ${
          isSidebarOpen
            ? "opacity-100"
            : "pointer-events-none opacity-0"
        }`}
      />

      <Sidebar
        user={user}
        activeRoom={activeRoom}
        isOpen={isSidebarOpen}
        onClose={handleCloseSidebar}
        onSelectRoom={handleSelectRoom}
        onLogout={handleLogout}
        onCreateRoom={roomDirectory.createRoom}
        onDeleteRoom={roomDirectory.deleteRoom}
        onOpenDirectMessage={handleOpenDirectMessage}
        {...roomDirectory}
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <RoomChatPanel
          key={activeRoom?.id ?? "no-room"}
          user={user}
          token={token}
          activeRoom={activeRoom}
          messages={messages}
          setMessages={setMessages}
          addMessage={addMessage}
          onOpenSidebar={handleOpenSidebar}
        />
      </div>
    </div>
  );
}
