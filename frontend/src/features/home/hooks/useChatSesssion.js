import { useEffect, useRef, useState } from "react";
import api from "../../../services/api";
import { connectSocket, disconnectSocket, sendMessage } from "../../../services/socket";
import {
  mergeTimelineMessages,
  normalizeFileMessage,
  normalizeTextHistoryMessage,
  normalizeTextSocketMessage,
} from "../../../utils/chatMessages";

export default function useChatSession({
  user,
  token,
  activeRoom,
  messages,
  setMessages,
  addMessage,
}) {
  const [input, setInput] = useState("");
  const [typingUsers, setTypingUsers] = useState({});
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileCaption, setFileCaption] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const messagesEndRef = useRef(null);
  const typingTimers = useRef({});
  const localTypingTimer = useRef(null);
  const isTypingRef = useRef(false);
  const stopTypingRef = useRef(() => {});

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages]);

  const stopTyping = (roomId = activeRoom?.id) => {
    clearTimeout(localTypingTimer.current);

    if (!roomId || !isTypingRef.current || !user?.username) return;

    sendMessage({
      type: "STOP_TYPING",
      roomId,
      senderUsername: user.username,
    });

    isTypingRef.current = false;
  };

  useEffect(() => {
    stopTypingRef.current = stopTyping;
  });

  useEffect(() => {
    let isCancelled = false;

    disconnectSocket();

    if (!activeRoom) return undefined;

    const loadRoomTimeline = async () => {
      try {
        const [textHistoryResult, fileHistoryResult] = await Promise.allSettled([
          api.get(`/api/messages/${activeRoom.id}`),
          api.get(`/api/files/history/${activeRoom.id}`),
        ]);

        if (isCancelled) return;

        const textHistory =
          textHistoryResult.status === "fulfilled"
            ? (textHistoryResult.value.data ?? []).map(normalizeTextHistoryMessage)
            : [];

        const fileHistory =
          fileHistoryResult.status === "fulfilled"
            ? (fileHistoryResult.value.data ?? []).map(normalizeFileMessage)
            : [];

        if (textHistoryResult.status === "rejected") {
          console.error("Failed to load text history:", textHistoryResult.reason);
        }

        if (fileHistoryResult.status === "rejected") {
          console.error("Failed to load file history:", fileHistoryResult.reason);
        }

        const timeline = mergeTimelineMessages(
          textHistory,
          fileHistory
        );

        setMessages(timeline);
      } catch (error) {
        if (isCancelled) return;

        console.error("Failed to load room timeline:", error);
        setMessages([]);
      }
    };

    loadRoomTimeline();

    connectSocket(
      token,
      {
        onRoomMessage: (message) => {
          if (message.type === "TYPING") {
            if (message.senderUsername === user?.username) return;

            setTypingUsers((prev) => {
              const typers = new Set(prev[message.roomId] || []);
              typers.add(message.senderUsername);

              return {
                ...prev,
                [message.roomId]: typers,
              };
            });

            const key = `${message.roomId}_${message.senderUsername}`;

            clearTimeout(typingTimers.current[key]);

            typingTimers.current[key] = setTimeout(() => {
              setTypingUsers((prev) => {
                const typers = new Set(prev[message.roomId] || []);
                typers.delete(message.senderUsername);

                return {
                  ...prev,
                  [message.roomId]: typers,
                };
              });
            }, 2000);

            return;
          }

          if (message.type === "STOP_TYPING") {
            if (message.senderUsername === user?.username) return;

            const key = `${message.roomId}_${message.senderUsername}`;
            clearTimeout(typingTimers.current[key]);

            setTypingUsers((prev) => {
              const typers = new Set(prev[message.roomId] || []);
              typers.delete(message.senderUsername);

              return {
                ...prev,
                [message.roomId]: typers,
              };
            });

            return;
          }

          addMessage(normalizeTextSocketMessage(message));
        },
        onFileMessage: (message) => {
          addMessage(normalizeFileMessage(message));
        },
      },
      activeRoom.id
    );

    return () => {
      isCancelled = true;
      stopTypingRef.current(activeRoom.id);
      clearTimeout(localTypingTimer.current);
      disconnectSocket();
    };
  }, [activeRoom, token, user?.username, setMessages, addMessage]);

  const handleInputChange = (value) => {
    setInput(value);

    if (!activeRoom || !user?.username) return;
    if (!value.trim() && !isTypingRef.current) return;

    sendMessage({
      type: "TYPING",
      roomId: activeRoom.id,
      senderUsername: user.username,
    });

    isTypingRef.current = true;

    clearTimeout(localTypingTimer.current);

    localTypingTimer.current = setTimeout(() => {
      stopTyping(activeRoom.id);
    }, 2000);
  };

  const handleFileSelect = (file) => {
    if (!file) return;

    setSelectedFile(file);
    setUploadError("");
  };

  const removeSelectedFile = () => {
    if (isUploading) return;

    setSelectedFile(null);
    setFileCaption("");
    setUploadError("");
  };

  const uploadSelectedFile = async () => {
    if (!selectedFile || !activeRoom || !user?.username || isUploading) return;

    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("chatRoomId", activeRoom.id);
    formData.append("sender", user.username);

    if (fileCaption.trim()) {
      formData.append("caption", fileCaption.trim());
    }

    setIsUploading(true);
    setUploadError("");

    try {
      await api.post("/api/files/upload", formData);
      setSelectedFile(null);
      setFileCaption("");
    } catch (error) {
      const message =
        error?.response?.data?.error ?? "Upload failed. Please try again.";

      setUploadError(message);
    } finally {
      setIsUploading(false);
    }
  };

  const sendCurrentMessage = () => {
    if (!input.trim() || !activeRoom || !user?.username) return;

    sendMessage({
      type: "CHAT",
      roomId: activeRoom.id,
      senderUsername: user.username,
      content: input.trim(),
      sentAt: new Date().toISOString(),
    });

    stopTyping(activeRoom.id);
    setInput("");
  };

  const currentTypers = activeRoom
    ? [...(typingUsers[activeRoom.id] || [])]
    : [];

  const typingLabel =
    currentTypers.length === 1
      ? `${currentTypers[0]} is typing...`
      : currentTypers.length > 1
        ? `${currentTypers.join(", ")} are typing...`
        : null;

  return {
    input,
    setInput,
    messagesEndRef,
    typingLabel,
    selectedFile,
    fileCaption,
    isUploading,
    uploadError,
    handleInputChange,
    handleFileSelect,
    setFileCaption,
    removeSelectedFile,
    uploadSelectedFile,
    sendCurrentMessage,
  };
}
