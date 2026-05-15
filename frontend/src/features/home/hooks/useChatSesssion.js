/* eslint-disable react-hooks/immutability */
import { useEffect, useRef, useState } from "react";
import api from "../../../services/api";
import { connectSocket, disconnectSocket, sendMessage } from "../../../services/socket";

export default function useChatSession({
  user,
  token,
  activeRoom,
  messages,
  setMessages,
  addMessage,
}) {
  // ── Local State ──────────────────────────────────────────────────────────
  const [input, setInput] = useState("");
  const [typingUsers, setTypingUsers] = useState({}); // { [roomId]: Set<username> }

  // ── Refs ─────────────────────────────────────────────────────────────────
  const messagesEndRef = useRef(null);
  const typingTimers = useRef({});
  const localTypingTimer = useRef(null);
  const isTypingRef = useRef(false);

  // ── Auto Scroll to Latest Message ────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages]);

  // ── WebSocket + Message History ──────────────────────────────────────────
  useEffect(() => {
    // Disconnect previous socket
    disconnectSocket();

    // If no room selected, do nothing
    if (!activeRoom) return;

    // Load message history
    api.get(`/api/messages/${activeRoom.id}`).then((res) => {
      setMessages(
        res.data.map((msg) => ({
          roomId: msg.room?.id,
          senderUsername: msg.sender?.username,
          content: msg.content,
          sentAt: msg.sentAt,
        }))
      );
    });

    // Connect socket
    connectSocket(
      token,
      (msg) => {
        // User is typing
        if (msg.type === "TYPING") {
          if (msg.senderUsername === user?.username) return;

          // Add user to typing set
          setTypingUsers((prev) => {
            const typers = new Set(prev[msg.roomId] || []);
            typers.add(msg.senderUsername);
            return {
              ...prev,
              [msg.roomId]: typers,
            };
          });

          // Auto-remove after 3 seconds
          const key = `${msg.roomId}_${msg.senderUsername}`;

          clearTimeout(typingTimers.current[key]);

          typingTimers.current[key] = setTimeout(() => {
            setTypingUsers((prev) => {
              const typers = new Set(prev[msg.roomId] || []);
              typers.delete(msg.senderUsername);

              return {
                ...prev,
                [msg.roomId]: typers,
              };
            });
          }, 2000);
        }

        // User stopped typing
        else if (msg.type === "STOP_TYPING") {
          if (msg.senderUsername === user?.username) return;

          const key = `${msg.roomId}_${msg.senderUsername}`;
          clearTimeout(typingTimers.current[key]);

          setTypingUsers((prev) => {
            const typers = new Set(prev[msg.roomId] || []);
            typers.delete(msg.senderUsername);

            return {
              ...prev,
              [msg.roomId]: typers,
            };
          });
        }

        // Normal chat message
        else {
          addMessage(msg);
        }
      },
      activeRoom.id
    );

    // Cleanup when room changes or component unmounts
    return () => {
      stopTyping(activeRoom.id);
      clearTimeout(localTypingTimer.current);
      disconnectSocket();
    };
  }, [activeRoom]);

  // ── Stop Typing ──────────────────────────────────────────────────────────
  const stopTyping = (roomId = activeRoom?.id) => {
    clearTimeout(localTypingTimer.current);

    if (!roomId || !isTypingRef.current) return;

    sendMessage({
      type: "STOP_TYPING",
      roomId,
      senderUsername: user.username,
    });

    isTypingRef.current = false;
  };

  // ── Handle Input Change ──────────────────────────────────────────────────
  const handleInputChange = (value) => {
    setInput(value);

    if (!activeRoom) return;

    if (!value.trim() && !isTypingRef.current) return;

    // Send TYPING event
    sendMessage({
      type: "TYPING",
      roomId: activeRoom.id,
      senderUsername: user.username,
    });

    isTypingRef.current = true;

    // Reset timer
    clearTimeout(localTypingTimer.current);

    localTypingTimer.current = setTimeout(() => {
      stopTyping(activeRoom.id);
    }, 2000);
  };

  // ── Send Message ─────────────────────────────────────────────────────────
  const sendCurrentMessage = () => {
    if (!input.trim() || !activeRoom) return;

    sendMessage({
      type: "CHAT",
      roomId: activeRoom.id,
      senderUsername: user.username,
      content: input,
      sentAt: new Date().toISOString(),
    });

    stopTyping(activeRoom.id);
    setInput("");
  };

  // ── Derived Typing Label ─────────────────────────────────────────────────
  const currentTypers = activeRoom
    ? [...(typingUsers[activeRoom.id] || [])]
    : [];

  const typingLabel =
    currentTypers.length === 1
      ? `${currentTypers[0]} is typing...`
      : currentTypers.length > 1
      ? `${currentTypers.join(", ")} are typing...`
      : null;

  // ── Return Hook Data ─────────────────────────────────────────────────────
  return {
    input,
    setInput,
    messagesEndRef,
    typingLabel,
    handleInputChange,
    sendCurrentMessage,
  };
}