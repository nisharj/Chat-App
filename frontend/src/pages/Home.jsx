import { useNavigate } from "react-router-dom";
import api from "../services/api";
import useChatStore from "../store/useChatStore";
import { connectSocket, disconnectSocket, sendMessage } from "../services/socket";
import { useEffect, useState, useRef } from "react";

export default function Home() {
  const {
    user, token, logout,
    rooms, setRooms,
    activeRoom, setActiveRoom,
    messages, setMessages, addMessage,
  } = useChatStore();

  const [input, setInput]       = useState("");
  const [newRoom, setNewRoom]   = useState("");
  const [users, setUsers]       = useState([]);
  const [hoveredRoom, setHoveredRoom] = useState(null);
  const [typingUsers, setTypingUsers] = useState({});   // { [roomId]: Set<username> }
  const [onlineUsers, setOnlineUsers] = useState({});   // { [username]: boolean }

  const navigate        = useNavigate();
  const messagesEndRef  = useRef(null);
  const typingTimers    = useRef({});
  const localTypingTimer = useRef(null);
  const isTypingRef     = useRef(false);

  // ── Load users ────────────────────────────────────────────────────────────
  useEffect(() => {
    api.get("/api/users").then((res) => setUsers(res.data));
  }, []);

  // ── Load rooms ────────────────────────────────────────────────────────────
  useEffect(() => {
    api.get("/api/rooms").then((res) => {
      const unique = res.data.filter(
        (room, i, self) => i === self.findIndex((r) => r.id === room.id)
      );
      setRooms(unique);
    });
  }, []);

  // ── Poll online presence for all users every 15 s ─────────────────────────
  useEffect(() => {
    if (users.length === 0) return;
    const fetchPresence = async () => {
      const results = await Promise.all(
        users.map(async (u) => {
          try {
            const res = await api.get(`/api/presence/${u.username}`);
            return { username: u.username, online: res.data };
          } catch {
            return { username: u.username, online: false };
          }
        })
      );
      setOnlineUsers(Object.fromEntries(results.map(({ username, online }) => [username, online])));
    };
    fetchPresence();
    const interval = setInterval(fetchPresence, 15000);
    return () => clearInterval(interval);
  }, [users]);

  // ── Auto-scroll ────────────────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Keep own presence alive ───────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const ping = () =>
      api.post(`/api/presence/online?username=${user.username}`).catch(() => {});
    ping();
    const interval = setInterval(ping, 20000);
    return () => clearInterval(interval);
  }, [user]);

  // ── WebSocket — reconnect when room changes ────────────────────────────────
  useEffect(() => {
    disconnectSocket();
    if (!activeRoom) return;

    // Load history
    api.get(`/api/messages/${activeRoom.id}`).then((res) => {
      setMessages(
        res.data.map((msg) => ({
          roomId:          msg.room?.id,
          senderUsername:  msg.sender?.username,
          content:         msg.content,
          sentAt:          msg.sentAt,
        }))
      );
    });

    // Connect and route incoming frames
    connectSocket(
      token,
      (msg) => {
        if (msg.type === "TYPING") {
          if (msg.senderUsername === user?.username) return;

          // Show indicator
          setTypingUsers((prev) => {
            const typers = new Set(prev[msg.roomId] || []);
            typers.add(msg.senderUsername);
            return { ...prev, [msg.roomId]: typers };
          });

          // Auto-clear after 3 s of silence
          const key = `${msg.roomId}_${msg.senderUsername}`;
          clearTimeout(typingTimers.current[key]);
          typingTimers.current[key] = setTimeout(() => {
            setTypingUsers((prev) => {
              const typers = new Set(prev[msg.roomId] || []);
              typers.delete(msg.senderUsername);
              return { ...prev, [msg.roomId]: typers };
            });
          }, 3000);
        } else if (msg.type === "STOP_TYPING") {
          if (msg.senderUsername === user?.username) return;

          const key = `${msg.roomId}_${msg.senderUsername}`;
          clearTimeout(typingTimers.current[key]);
          setTypingUsers((prev) => {
            const typers = new Set(prev[msg.roomId] || []);
            typers.delete(msg.senderUsername);
            return { ...prev, [msg.roomId]: typers };
          });
        } else {
          addMessage(msg);
        }
      },
      activeRoom.id
    );

    return () => {
      stopTyping(activeRoom.id);
      clearTimeout(localTypingTimer.current);
      disconnectSocket();
    };
  }, [activeRoom]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const formatTime = (sentAt) => {
    if (!sentAt) return "";
    const date = new Date(sentAt);
    const isToday = date.toDateString() === new Date().toDateString();
    const time = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return isToday
      ? time
      : `${date.toLocaleDateString([], { month: "short", day: "numeric" })} ${time}`;
  };

  const getRoomDisplayName = (room) => {
    if (room.group) return room.name;
    if (room.name?.startsWith("dm_")) {
      const dmPart = room.name.replace("dm_", "");
      return dmPart.startsWith(user?.username + "_")
        ? dmPart.replace(user?.username + "_", "")
        : dmPart.replace("_" + user?.username, "");
    }
    return room.name;
  };

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleDeleteRoom = async (e, roomId) => {
    e.stopPropagation(); // don't also select the room
    if (!window.confirm("Delete this room and all its messages?")) return;
    await api.delete(`/api/rooms/${roomId}`);
    setRooms((prev) => prev.filter((r) => r.id !== roomId));
    if (activeRoom?.id === roomId) {
      setActiveRoom(null);
      setMessages([]);
    }
  };

  const handleDirectMessage = async (targetUsername) => {
    if (targetUsername === user.username) return;
    const res = await api.post(
      `/api/rooms/direct?user1=${user.username}&user2=${targetUsername}`
    );
    setRooms((prev) =>
      prev.find((r) => r.id === res.data.id) ? prev : [...prev, res.data]
    );
    setActiveRoom(res.data);
  };

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

  const handleTyping = (value) => {
    if (!activeRoom) return;

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
    }, 3000);
  };

  const handleSend = () => {
    if (!input.trim() || !activeRoom) return;
    sendMessage({
      type:           "CHAT",
      roomId:         activeRoom.id,
      senderUsername: user.username,
      content:        input,
      sentAt:         new Date().toISOString(),
    });
    stopTyping(activeRoom.id);
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

  // ── Derived state ─────────────────────────────────────────────────────────
  const groupRooms        = Array.isArray(rooms) ? rooms.filter((r) => r.group)  : [];
  const dmRooms           = Array.isArray(rooms) ? rooms.filter((r) => !r.group) : [];
  
  const currentTypers     = activeRoom
    ? [...(typingUsers[activeRoom.id] || [])]
    : [];
  const typingLabel       = currentTypers.length === 1
    ? `${currentTypers[0]} is typing...`
    : currentTypers.length > 1
    ? `${currentTypers.join(", ")} are typing...`
    : null;

  // ── Room item (reused for group + DM lists) ────────────────────────────────
  const RoomItem = ({ room, icon }) => {
    const isActive  = activeRoom?.id === room.id;
    const isHovered = hoveredRoom === room.id;
    return (
      <div
        style={{
          ...styles.roomItem,
          background: isActive ? "#e3f2fd" : isHovered ? "#f5f7fa" : "transparent",
          color:      isActive ? "#2563eb" : "#555",
          fontWeight: isActive ? "700" : "500",
        }}
        onClick={() => setActiveRoom(room)}
        onMouseEnter={() => setHoveredRoom(room.id)}
        onMouseLeave={() => setHoveredRoom(null)}
      >
        <span style={styles.roomItemLabel}>
          {icon} {getRoomDisplayName(room)}
        </span>
        {isHovered && (
          <button
            style={styles.deleteRoomBtn}
            onClick={(e) => handleDeleteRoom(e, room.id)}
            title="Delete room"
          >
            🗑
          </button>
        )}
      </div>
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={styles.container}>
      {/* Keyframes for typing dots */}
      <style>{`
        @keyframes typingBounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40%            { transform: translateY(-4px); opacity: 1; }
        }
        .typing-dot { display:inline-block; width:6px; height:6px; border-radius:50%;
          background:#2563eb; margin:0 2px; animation: typingBounce 1.2s infinite; }
        .typing-dot:nth-child(2) { animation-delay: 0.2s; }
        .typing-dot:nth-child(3) { animation-delay: 0.4s; }
      `}</style>

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <div style={styles.sidebar}>
        <div style={styles.sidebarHeader}>
          <span style={styles.logo}>💬 ChatApp</span>
          <button onClick={handleLogout} style={styles.logoutBtn}>Logout</button>
        </div>
        <div style={styles.userInfo}>👤 {user?.username}</div>

        {/* Create room */}
        <div style={styles.createRoom}>
          <input
            style={styles.roomInput}
            placeholder="New room name..."
            value={newRoom}
            onChange={(e) => setNewRoom(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreateRoom()}
          />
          <button style={styles.createBtn} onClick={handleCreateRoom}>+</button>
        </div>

        {/* Group channels */}
        <div style={styles.sectionTitle}>CHANNELS</div>
        <div style={styles.roomList}>
          {groupRooms.map((room) => (
            <RoomItem key={room.id} room={room} icon="#" />
          ))}
        </div>

        {/* Recent DMs */}
        {dmRooms.length > 0 && (
          <>
            <div style={styles.sectionTitle}>RECENT DMs</div>
            <div style={styles.roomList}>
              {dmRooms.map((room) => (
                <RoomItem key={room.id} room={room} icon="💬" />
              ))}
            </div>
          </>
        )}

        {/* Users list — click to open DM */}
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
                {/* Online / offline dot */}
                <span
                  style={{
                    ...styles.presenceDot,
                    background: onlineUsers[u.username] ? "#22c55e" : "#d1d5db",
                  }}
                  title={onlineUsers[u.username] ? "Online" : "Offline"}
                />
                {u.username}
              </div>
            ))}
        </div>
      </div>

      {/* ── Chat area ───────────────────────────────────────────────────── */}
      <div style={styles.chatArea}>
        {activeRoom ? (
          <>
            <div style={styles.chatHeader}>
              {activeRoom.group
                ? `# ${getRoomDisplayName(activeRoom)}`
                : `💬 ${getRoomDisplayName(activeRoom)}`}
            </div>

            <div style={styles.messages}>
              {(messages || []).map((msg, i) => {
                const isOwn = msg.senderUsername === user?.username;
                return (
                  <div
                    key={i}
                    style={{ ...styles.message, alignSelf: isOwn ? "flex-end" : "flex-start" }}
                  >
                    {!isOwn && <div style={styles.sender}>{msg.senderUsername}</div>}
                    <div
                      style={{
                        ...styles.bubble,
                        background: isOwn ? "#2563eb" : "#e5e7eb",
                        color:      isOwn ? "#fff"    : "#1a1a1a",
                      }}
                    >
                      {msg.content}
                    </div>
                    {/* Timestamp */}
                    <div style={{ ...styles.timestamp, alignSelf: isOwn ? "flex-end" : "flex-start" }}>
                      {formatTime(msg.sentAt)}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Typing indicator */}
            {typingLabel && (
              <div style={styles.typingIndicator}>
                <span className="typing-dot" />
                <span className="typing-dot" />
                <span className="typing-dot" />
                <span style={styles.typingLabel}>{typingLabel}</span>
              </div>
            )}

            <div style={styles.inputArea}>
              <input
                style={styles.messageInput}
                placeholder={`Message ${activeRoom.group ? "#" : ""}${getRoomDisplayName(activeRoom)}`}
                value={input}
                onChange={(e) => {
                  const value = e.target.value;
                  setInput(value);
                  handleTyping(value);
                }}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
              />
              <button style={styles.sendBtn} onClick={handleSend}>Send</button>
            </div>
          </>
        ) : (
          <div style={styles.noRoom}>👈 Select a room to start chatting</div>
        )}
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = {
  container:     { display:"flex", height:"100vh", background:"#f5f7fa", color:"#1a1a1a", fontFamily:"'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" },
  sidebar:       { width:"280px", background:"#fff", display:"flex", flexDirection:"column", borderRight:"1px solid #e0e0e0", overflowY:"auto", boxShadow:"0 2px 8px rgba(0,0,0,0.05)" },
  sidebarHeader: { display:"flex", justifyContent:"space-between", alignItems:"center", padding:"20px 16px", borderBottom:"1px solid #f0f0f0" },
  logo:          { color:"#2563eb", fontWeight:"700", fontSize:"18px", letterSpacing:"-0.5px" },
  logoutBtn:     { background:"#fff", border:"1.5px solid #e91e63", color:"#e91e63", padding:"6px 12px", borderRadius:"6px", cursor:"pointer", fontSize:"12px", fontWeight:"600" },
  userInfo:      { padding:"14px 16px", color:"#666", fontSize:"13px", fontWeight:"500", borderBottom:"1px solid #f0f0f0", background:"#fafafa" },
  createRoom:    { display:"flex", padding:"14px", gap:"8px" },
  roomInput:     { flex:1, padding:"10px 12px", background:"#f5f7fa", border:"1.5px solid #e0e0e0", borderRadius:"8px", color:"#1a1a1a", fontSize:"13px", fontWeight:"500" },
  createBtn:     { padding:"10px 14px", background:"#2563eb", border:"none", borderRadius:"8px", color:"#fff", cursor:"pointer", fontSize:"18px", fontWeight:"600" },
  sectionTitle:  { padding:"12px 16px 8px", fontSize:"11px", color:"#999", letterSpacing:"0.5px", fontWeight:"700", textTransform:"uppercase" },
  roomList:      { padding:"6px 8px" },
  roomItem:      { display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 14px", borderRadius:"8px", cursor:"pointer", marginBottom:"4px", fontSize:"14px", transition:"all 0.2s ease" },
  roomItemLabel: { display:"flex", alignItems:"center", gap:"6px", flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" },
  deleteRoomBtn: { background:"transparent", border:"none", cursor:"pointer", fontSize:"14px", padding:"2px 4px", borderRadius:"4px", opacity:0.6, flexShrink:0, lineHeight:1 },
  presenceDot:   { display:"inline-block", width:"8px", height:"8px", borderRadius:"50%", marginRight:"8px", flexShrink:0 },
  chatArea:      { flex:1, display:"flex", flexDirection:"column", background:"#fff" },
  chatHeader:    { padding:"18px 24px", background:"#fff", borderBottom:"1px solid #e0e0e0", fontWeight:"700", fontSize:"16px" },
  messages:      { flex:1, overflowY:"auto", padding:"24px", display:"flex", flexDirection:"column", gap:"10px", background:"#f9fafb" },
  message:       { display:"flex", flexDirection:"column", maxWidth:"65%" },
  sender:        { fontSize:"12px", color:"#666", marginBottom:"3px", paddingLeft:"4px", fontWeight:"600" },
  bubble:        { padding:"12px 16px", borderRadius:"12px", fontSize:"14px", lineHeight:"1.5", wordWrap:"break-word" },
  timestamp:     { fontSize:"11px", color:"#aaa", marginTop:"3px", paddingLeft:"2px", paddingRight:"2px" },
  typingIndicator: { display:"flex", alignItems:"center", gap:"4px", padding:"6px 24px 2px", minHeight:"24px" },
  typingLabel:   { fontSize:"12px", color:"#888", marginLeft:"4px" },
  inputArea:     { display:"flex", padding:"18px 24px", gap:"12px", borderTop:"1px solid #e0e0e0", background:"#fff" },
  messageInput:  { flex:1, padding:"12px 14px", background:"#f5f7fa", border:"1.5px solid #e0e0e0", borderRadius:"8px", color:"#1a1a1a", fontSize:"14px", fontWeight:"500" },
  sendBtn:       { padding:"12px 28px", background:"#2563eb", border:"none", borderRadius:"8px", color:"#fff", cursor:"pointer", fontWeight:"700", fontSize:"14px" },
  noRoom:        { flex:1, display:"flex", alignItems:"center", justifyContent:"center", color:"#999", fontSize:"18px", fontWeight:"500" },
};
