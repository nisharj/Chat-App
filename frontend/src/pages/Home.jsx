import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

import api from "../services/api";
import useChatStore from "../store/useChatStore";

import Sidebar from "../features/home/components/Sidebar";
import ChatPanel from "../features/home/components/ChatPanel";

import useRoomDirectory from "../features/home/hooks/useRoomDirectory";
import useChatSession from "../features/home/hooks/useChatSesssion";

export default function Home() {
  // ── Zustand Store ────────────────────────────────────────────────────────
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

  // ── Room / User Management Hook ──────────────────────────────────────────
  const roomDirectory = useRoomDirectory({
    user,
    rooms,
    activeRoom,
    setRooms,
    setActiveRoom,
    setMessages,
  });

  // ── Chat Session Hook ────────────────────────────────────────────────────
  const chatSession = useChatSession({
    user,
    token,
    activeRoom,
    messages,
    setMessages,
    addMessage,
  });

  // ── Keep Current User Presence Alive ─────────────────────────────────────
  useEffect(() => {
    if (!user) return;

    const ping = () =>
      api
        .post(`/api/presence/online?username=${user.username}`)
        .catch(() => {});

    // Ping immediately
    ping();

    // Ping every 20 seconds
    const interval = setInterval(ping, 20000);

    return () => clearInterval(interval);
  }, [user]);

  // ── Logout Handler ───────────────────────────────────────────────────────
  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen bg-gray-100 text-gray-900">
      {/* Sidebar */}
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

      {/* Chat Panel */}
      <ChatPanel
        user={user}
        activeRoom={activeRoom}
        messages={messages}
        messagesEndRef={chatSession.messagesEndRef}
        typingLabel={chatSession.typingLabel}
        input={chatSession.input}
        onInputChange={chatSession.handleInputChange}
        onSend={chatSession.sendCurrentMessage}
      />
    </div>
  );
}