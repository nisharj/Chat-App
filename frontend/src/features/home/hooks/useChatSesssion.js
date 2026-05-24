import { useEffect, useMemo, useRef, useState } from "react";
import api, {
  getApiErrorMessage,
  isForbiddenError,
} from "../../../services/api";
import {
  connectSocket,
  disconnectSocket,
  sendMessage,
} from "../../../services/socket";
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
  applyDeleteEvent,
}) {
  const [input, setInput] = useState("");
  const [typingUsers, setTypingUsers] = useState({});
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileCaption, setFileCaption] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [chatError, setChatError] = useState("");
  const [selectedMessages, setSelectedMessages] = useState([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

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

    try {
      sendMessage({
        type: "STOP_TYPING",
        roomId,
      });
    } catch {
      // Typing events are best-effort only.
    }

    isTypingRef.current = false;
  };

  useEffect(() => {
    stopTypingRef.current = stopTyping;
  });

  const toggleMessageSelection = (message) => {
    const messageId = String(message?.id ?? "");

    if (!messageId) return;

    setSelectedMessages((prev) =>
      prev.includes(messageId)
        ? prev.filter((id) => id !== messageId)
        : [...prev, messageId],
    );
  };

  const clearSelection = () => {
    setSelectedMessages([]);
    setShowDeleteModal(false);
  };

  useEffect(() => {
    let isCancelled = false;

    disconnectSocket();

    if (!activeRoom) return undefined;

    const loadRoomTimeline = async () => {
      const [textHistoryResult, fileHistoryResult] = await Promise.allSettled([
        api.get(`/api/messages/${activeRoom.id}`),
        api.get(`/api/files/history/${activeRoom.id}`),
      ]);

      if (isCancelled) return;

      const anyForbidden = [textHistoryResult, fileHistoryResult].some(
        (result) =>
          result.status === "rejected" && isForbiddenError(result.reason),
      );

      if (anyForbidden) {
        setMessages([]);
        setChatError("You no longer have access to this room.");
        return;
      }

      const textHistory =
        textHistoryResult.status === "fulfilled"
          ? (textHistoryResult.value.data ?? []).map(
              normalizeTextHistoryMessage,
            )
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

      const timeline = mergeTimelineMessages(textHistory, fileHistory);
      setMessages((currentMessages) =>
        mergeTimelineMessages(currentMessages, timeline),
      );
      setChatError("");

      if (
        textHistoryResult.status === "rejected" ||
        fileHistoryResult.status === "rejected"
      ) {
        setChatError("Some room content could not be loaded completely.");
      }
    };

    loadRoomTimeline().catch((error) => {
      if (isCancelled) return;

      setMessages([]);
      setChatError(
        getApiErrorMessage(error, "Could not load this conversation."),
      );
    });

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
        onDeleteMessage: (event) => {
          applyDeleteEvent?.(event);
        },
        onError: (message) => {
          setChatError(message);
        },
      },
      activeRoom.id,
    );

    return () => {
      isCancelled = true;
      stopTypingRef.current(activeRoom.id);
      clearTimeout(localTypingTimer.current);
      disconnectSocket();
    };
  }, [
    activeRoom,
    token,
    user?.username,
    setMessages,
    addMessage,
    applyDeleteEvent,
  ]);

  const handleInputChange = (value) => {
    setInput(value);
    setChatError("");

    if (!activeRoom || !user?.username) return;
    if (!value.trim() && !isTypingRef.current) return;

    try {
      sendMessage({
        type: "TYPING",
        roomId: activeRoom.id,
      });
    } catch {
      // Typing events are best-effort only.
    }

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
    setChatError("");
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

    if (fileCaption.trim()) {
      formData.append("caption", fileCaption.trim());
    }

    setIsUploading(true);
    setUploadError("");
    setChatError("");

    try {
      await api.post("/api/files/upload", formData);
      setSelectedFile(null);
      setFileCaption("");
    } catch (error) {
      setUploadError(
        getApiErrorMessage(error, "Upload failed. Please try again."),
      );
    } finally {
      setIsUploading(false);
    }
  };

  const sendCurrentMessage = () => {
    if (!input.trim() || !activeRoom || !user?.username) return;

    try {
      sendMessage({
        type: "CHAT",
        roomId: activeRoom.id,
        content: input.trim(),
        sentAt: new Date().toISOString(),
      });

      stopTyping(activeRoom.id);
      setInput("");
      setChatError("");
    } catch (error) {
      setChatError(error?.message ?? "Could not send your message.");
    }
  };

  const selectedMessagesDetails = useMemo(
    () =>
      (messages ?? []).filter((message) =>
        selectedMessages.includes(String(message?.id ?? "")),
      ),
    [messages, selectedMessages],
  );

  const canDeleteSelectedForEveryone =
    selectedMessagesDetails.length > 0 &&
    selectedMessagesDetails.every(
      (message) => message.senderUsername === user?.username,
    );

  const deleteSelectedMessages = async (deleteType) => {
    if (!activeRoom || selectedMessages.length === 0) return;

    if (deleteType === "FOR_EVERYONE" && !canDeleteSelectedForEveryone) {
      setChatError("You can only delete your own text messages for everyone.");
      return;
    }

    try {
      await api.post("/api/messages/delete", {
        messageIds: selectedMessages,
        deleteType,
        chatRoomId: activeRoom.id,
      });

      clearSelection();
      setChatError("");
    } catch (error) {
      setChatError(
        getApiErrorMessage(error, "Could not delete the selected messages."),
      );
    }
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
    chatError,
    handleInputChange,
    handleFileSelect,
    setFileCaption,
    removeSelectedFile,
    uploadSelectedFile,
    sendCurrentMessage,
    selectedMessages,
    showDeleteModal,
    setShowDeleteModal,
    toggleMessageSelection,
    clearSelection,
    deleteSelectedMessages,
    canDeleteSelectedForEveryone,
  };
}
