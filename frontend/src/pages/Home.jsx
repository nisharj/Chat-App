import { useNavigate } from "react-router-dom";
import api from "../services/api";
import useChatStore from "../store/useChatStore";
import {
  connectSocket,
  disconnectSocket,
  sendMessage,
} from "../services/socket";
import { useEffect, useState, useRef } from 'react'

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
  const navigate = useNavigate();
  const messagesEndRef = useRef(null)

  // load rooms on start
  useEffect(() => {
    api.get("/api/rooms").then((res) => setRooms(res.data));
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

  //ping server every 20s to keep session alive and show online status
  useEffect(() => {
    if (!user) return;
    const ping = () =>
      api.post(`/api/presence/online?username=${user.username}`);
    ping();
    const interval = setInterval(ping, 20000);
    return () => clearInterval(interval);
  }, [user]);

  // connect websocket when room changes
  useEffect(() => {
    disconnectSocket();
    if (activeRoom) {
      api.get(`/api/messages/${activeRoom.id}`).then((res) => {
        // normalize REST messages to match WebSocket message format
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

  const handleSend = () => {
    if (!input.trim() || !activeRoom) return;

    const messageDTO = {
      roomId: activeRoom.id,
      senderUsername: user.username,
      content: input,
      sentAt: new Date().toISOString(),
    };

    addMessage(messageDTO)
    sendMessage(messageDTO)
    setInput("")
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

        {/* Room List */}
        <div style={styles.roomList}>
          {rooms.map((room) => (
            <div
              key={room.id}
              style={{
                ...styles.roomItem,
                background:
                  activeRoom?.id === room.id ? "#0f3460" : "transparent",
              }}
              onClick={() => setActiveRoom(room)}
            >
              # {room.name}
            </div>
          ))}
        </div>
      </div>

      {/* ChatArea */}
      <div style={styles.chatArea}>
        {activeRoom ? (
          <>
            <div style={styles.chatHeader}>#{activeRoom.name}</div>
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
                          ? "#e94560"
                          : "#0f3460",
                    }}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
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
                S end
              </button>
            </div>
          </>
        ) : (
          <div style={styles.noRoom}>👈 Select a room to start chatting</div>
        )}
      <div ref={messagesEndRef} />
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: "flex",
    height: "100vh",
    background: "#1a1a2e",
    color: "#fff",
  },
  sidebar: {
    width: "260px",
    background: "#16213e",
    display: "flex",
    flexDirection: "column",
    borderRight: "1px solid #0f3460",
  },
  sidebarHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "16px",
    borderBottom: "1px solid #0f3460",
  },
  logo: { color: "#e94560", fontWeight: "bold", fontSize: "16px" },
  logoutBtn: {
    background: "transparent",
    border: "1px solid #e94560",
    color: "#e94560",
    padding: "4px 10px",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "12px",
  },
  userInfo: {
    padding: "10px 16px",
    color: "#aaa",
    fontSize: "13px",
    borderBottom: "1px solid #0f3460",
  },
  createRoom: { display: "flex", padding: "12px", gap: "8px" },
  roomInput: {
    flex: 1,
    padding: "8px",
    background: "#0f3460",
    border: "none",
    borderRadius: "6px",
    color: "#fff",
    fontSize: "13px",
  },
  createBtn: {
    padding: "8px 12px",
    background: "#e94560",
    border: "none",
    borderRadius: "6px",
    color: "#fff",
    cursor: "pointer",
    fontSize: "16px",
  },
  roomList: { flex: 1, overflowY: "auto", padding: "8px" },
  roomItem: {
    padding: "10px 14px",
    borderRadius: "8px",
    cursor: "pointer",
    marginBottom: "4px",
    fontSize: "14px",
    color: "#ccc",
  },
  chatArea: { flex: 1, display: "flex", flexDirection: "column" },
  chatHeader: {
    padding: "16px 20px",
    background: "#16213e",
    borderBottom: "1px solid #0f3460",
    fontWeight: "bold",
    fontSize: "16px",
  },
  messages: {
    flex: 1,
    overflowY: "auto",
    padding: "20px",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  message: { display: "flex", flexDirection: "column", maxWidth: "60%" },
  sender: {
    fontSize: "11px",
    color: "#aaa",
    marginBottom: "2px",
    paddingLeft: "4px",
  },
  bubble: {
    padding: "10px 14px",
    borderRadius: "12px",
    fontSize: "14px",
    lineHeight: "1.4",
  },
  inputArea: {
    display: "flex",
    padding: "16px",
    gap: "10px",
    borderTop: "1px solid #0f3460",
  },
  messageInput: {
    flex: 1,
    padding: "12px",
    background: "#0f3460",
    border: "none",
    borderRadius: "8px",
    color: "#fff",
    fontSize: "14px",
  },
  sendBtn: {
    padding: "12px 24px",
    background: "#e94560",
    border: "none",
    borderRadius: "8px",
    color: "#fff",
    cursor: "pointer",
    fontWeight: "bold",
  },
  noRoom: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#aaa",
    fontSize: "18px",
  },
};
