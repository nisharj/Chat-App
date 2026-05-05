import { useNavigate } from "react-router-dom";
import api from "../services/api";
import useChatStore from "../store/useChatStore";
import {
  connectSocket,
  disconnectSocket,
  sendMessage,
} from "../services/socket";
import { useEffect, useState, useRef } from "react";

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
  const [input, setInput] = useState("");
  const [newRoom, setNewRoom] = useState("");
  const [users, setUsers] = useState([]);
  const navigate = useNavigate();
  const messagesEndRef = useRef(null);

  // load users on start
  useEffect(() => {
    api.get("/api/users").then((res) => setUsers(res.data));
  }, []);

  // load rooms on start
  useEffect(() => {
    api.get("/api/rooms").then((res) => {
      const unique = res.data.filter(
        (room, index, self) =>
          index === self.findIndex((r) => r.id === room.id),
      );
      setRooms(unique);
    });
  }, []);

  // auto scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ping server every 20s to stay online
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

  // connect websocket when room changes
  useEffect(() => {
    disconnectSocket();
    if (activeRoom) {
      api.get(`/api/messages/${activeRoom.id}`).then((res) => {
        const normalized = res.data.map((msg) => ({
          roomId: msg.room?.id,
          senderUsername: msg.sender?.username,
          content: msg.content,
          sentAt: msg.sentAt,
        }));
        setMessages(normalized);
      });
      connectSocket(token, (msg) => addMessage(msg), activeRoom.id);
    }
    return () => disconnectSocket();
  }, [activeRoom]);

  // get display name for DM rooms
  const getRoomDisplayName = (room) => {
    if (room.group) return `# ${room.name}`;
    if (room.name?.startsWith("dm_")) {
      const dmPart = room.name.replace("dm_", "");
      // find which part is NOT the current user
      const otherUser = dmPart.startsWith(user?.username + "_")
        ? dmPart.replace(user?.username + "_", "")
        : dmPart.replace("_" + user?.username, "");
      return `💬 ${otherUser}`;
    }
    return `# ${room.name}`;
  };

  const handleDirectMessage = async (targetUsername) => {
    if (targetUsername === user.username) return;
    const res = await api.post(
      `/api/rooms/direct?user1=${user.username}&user2=${targetUsername}`,
    );
    setRooms((prev) =>
      prev.find((r) => r.id === res.data.id) ? prev : [...prev, res.data],
    );
    setActiveRoom(res.data);
  };

  const handleSend = () => {
    if (!input.trim() || !activeRoom) return;

    const messageDTO = {
      roomId: activeRoom.id,
      senderUsername: user.username,
      content: input,
      sentAt: new Date().toISOString(),
    };

    // only send via WebSocket — it will echo back and addMessage will be called
    sendMessage(messageDTO);
    setInput("");
  };

  const handleCreateRoom = async () => {
    if (!newRoom.trim()) return;
    const res = await api.post(`/api/rooms?name=${newRoom}&isGroup=true`);
    setRooms([...rooms, res.data]);
    setNewRoom("");
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  // separate group rooms and DM rooms
  const groupRooms = Array.isArray(rooms) ? rooms.filter((r) => r.group) : [];
  const dmRooms = Array.isArray(rooms) ? rooms.filter((r) => !r.group) : [];

  return (
    <div style={styles.container}>
      {/* Sidebar */}
      <div style={styles.sidebar}>
        <div style={styles.sidebarHeader}>
          <span style={styles.logo}>💬 ChatApp</span>
          <button onClick={handleLogout} style={styles.logoutBtn}>
            Logout
          </button>
        </div>
        <div style={styles.userInfo}>👤 {user?.username}</div>

        {/* Create Room */}
        <div style={styles.createRoom}>
          <input
            style={styles.roomInput}
            placeholder="New room name..."
            value={newRoom}
            onChange={(e) => setNewRoom(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreateRoom()}
          />
          <button style={styles.createBtn} onClick={handleCreateRoom}>
            +
          </button>
        </div>

        {/* Group Rooms */}
        <div style={styles.sectionTitle}>CHANNELS</div>
        <div style={styles.roomList}>
          {groupRooms.map((room) => (
            <div
              key={room.id}
              style={{
                ...styles.roomItem,
                background:
                  activeRoom?.id === room.id ? "#e3f2fd" : "transparent",
                color: activeRoom?.id === room.id ? "#2563eb" : "#555",
                fontWeight: activeRoom?.id === room.id ? "700" : "500",
              }}
              onClick={() => setActiveRoom(room)}
            >
              {getRoomDisplayName(room)}
            </div>
          ))}
        </div>

        {/* DM Rooms already opened */}
        {dmRooms.length > 0 && (
          <>
            <div style={styles.sectionTitle}>RECENT DMs</div>
            <div style={styles.roomList}>
              {dmRooms.map((room) => (
                <div
                  key={room.id}
                  style={{
                    ...styles.roomItem,
                    background:
                      activeRoom?.id === room.id ? "#e3f2fd" : "transparent",
                    color: activeRoom?.id === room.id ? "#2563eb" : "#555",
                    fontWeight: activeRoom?.id === room.id ? "700" : "500",
                  }}
                  onClick={() => setActiveRoom(room)}
                >
                  {getRoomDisplayName(room)}
                </div>
              ))}
            </div>
          </>
        )}

        {/* Users List for new DMs */}
        <div style={styles.sectionTitle}>DIRECT MESSAGES</div>
        <div style={styles.roomList}>
          {users
            .filter((u) => u.username !== user?.username)
            .map((u) => (
              <div
                key={u.id}
                style={styles.roomItem}
                onClick={() => handleDirectMessage(u.username)}
              >
                🟢 {u.username}
              </div>
            ))}
        </div>
      </div>

      {/* Chat Area */}
      <div style={styles.chatArea}>
        {activeRoom ? (
          <>
            <div style={styles.chatHeader}>
              {getRoomDisplayName(activeRoom)}
            </div>

            <div style={styles.messages}>
              {(messages || []).map((msg, i) => (
                <div
                  key={i}
                  style={{
                    ...styles.message,
                    alignSelf:
                      msg.senderUsername === user?.username
                        ? "flex-end"
                        : "flex-start",
                  }}
                >
                  {msg.senderUsername !== user?.username && (
                    <div style={styles.sender}>{msg.senderUsername}</div>
                  )}
                  <div
                    style={{
                      ...styles.bubble,
                      background:
                        msg.senderUsername === user?.username
                          ? "#2563eb"
                          : "#e5e7eb",
                      color:
                        msg.senderUsername === user?.username
                          ? "#fff"
                          : "#1a1a1a",
                    }}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <div style={styles.inputArea}>
              <input
                style={styles.messageInput}
                placeholder="Type a message..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
              />
              <button style={styles.sendBtn} onClick={handleSend}>
                Send
              </button>
            </div>
          </>
        ) : (
          <div style={styles.noRoom}>👈 Select a room to start chatting</div>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: "flex",
    height: "100vh",
    background: "#f5f7fa",
    color: "#1a1a1a",
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
  },
  sidebar: {
    width: "280px",
    background: "#fff",
    display: "flex",
    flexDirection: "column",
    borderRight: "1px solid #e0e0e0",
    overflowY: "auto",
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.05)",
  },
  sidebarHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "20px 16px",
    borderBottom: "1px solid #f0f0f0",
    background: "#fff",
  },
  logo: {
    color: "#2563eb",
    fontWeight: "700",
    fontSize: "18px",
    letterSpacing: "-0.5px",
  },
  logoutBtn: {
    background: "#fff",
    border: "1.5px solid #e91e63",
    color: "#e91e63",
    padding: "6px 12px",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: "600",
    transition: "all 0.3s ease",
  },
  userInfo: {
    padding: "14px 16px",
    color: "#666",
    fontSize: "13px",
    fontWeight: "500",
    borderBottom: "1px solid #f0f0f0",
    background: "#fafafa",
  },
  createRoom: {
    display: "flex",
    padding: "14px",
    gap: "8px",
    background: "#fff",
  },
  roomInput: {
    flex: 1,
    padding: "10px 12px",
    background: "#f5f7fa",
    border: "1.5px solid #e0e0e0",
    borderRadius: "8px",
    color: "#1a1a1a",
    fontSize: "13px",
    transition: "all 0.3s ease",
    fontWeight: "500",
  },
  createBtn: {
    padding: "10px 14px",
    background: "#2563eb",
    border: "none",
    borderRadius: "8px",
    color: "#fff",
    cursor: "pointer",
    fontSize: "18px",
    fontWeight: "600",
    transition: "all 0.3s ease",
  },
  sectionTitle: {
    padding: "12px 16px 8px",
    fontSize: "11px",
    color: "#999",
    letterSpacing: "0.5px",
    fontWeight: "700",
    textTransform: "uppercase",
  },
  roomList: { padding: "6px 8px" },
  roomItem: {
    padding: "12px 14px",
    borderRadius: "8px",
    cursor: "pointer",
    marginBottom: "6px",
    fontSize: "14px",
    color: "#555",
    fontWeight: "500",
    transition: "all 0.2s ease",
  },
  chatArea: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    background: "#fff",
  },
  chatHeader: {
    padding: "18px 24px",
    background: "#fff",
    borderBottom: "1px solid #e0e0e0",
    fontWeight: "700",
    fontSize: "16px",
    color: "#1a1a1a",
  },
  messages: {
    flex: 1,
    overflowY: "auto",
    padding: "24px",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    background: "#f9fafb",
  },
  message: {
    display: "flex",
    flexDirection: "column",
    maxWidth: "65%",
    animation: "fadeIn 0.3s ease",
  },
  sender: {
    fontSize: "12px",
    color: "#666",
    marginBottom: "4px",
    paddingLeft: "4px",
    fontWeight: "600",
  },
  bubble: {
    padding: "12px 16px",
    borderRadius: "12px",
    fontSize: "14px",
    lineHeight: "1.5",
    boxShadow: "0 2px 4px rgba(0, 0, 0, 0.08)",
    wordWrap: "break-word",
  },
  inputArea: {
    display: "flex",
    padding: "18px 24px",
    gap: "12px",
    borderTop: "1px solid #e0e0e0",
    background: "#fff",
  },
  messageInput: {
    flex: 1,
    padding: "12px 14px",
    background: "#f5f7fa",
    border: "1.5px solid #e0e0e0",
    borderRadius: "8px",
    color: "#1a1a1a",
    fontSize: "14px",
    transition: "all 0.3s ease",
    fontWeight: "500",
  },
  sendBtn: {
    padding: "12px 28px",
    background: "#2563eb",
    border: "none",
    borderRadius: "8px",
    color: "#fff",
    cursor: "pointer",
    fontWeight: "700",
    transition: "all 0.3s ease",
    fontSize: "14px",
  },
  noRoom: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#999",
    fontSize: "18px",
    fontWeight: "500",
  },
};
