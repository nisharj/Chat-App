import { FaEnvelope } from "react-icons/fa";
import { HiUserGroup } from "react-icons/hi2";

export default function ChatPanel({
  user,
  activeRoom,
  messages,
  messagesEndRef,
  typingLabel,
  input,
  onInputChange,
  onSend,
}) {
  // ── Format Timestamp ────────────────────────────────────────────────────
  const formatTime = (sentAt) => {
    if (!sentAt) return "";

    const date = new Date(sentAt);
    const isToday = date.toDateString() === new Date().toDateString();

    const time = date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    return isToday
      ? time
      : `${date.toLocaleDateString([], {
          month: "short",
          day: "numeric",
        })} ${time}`;
  };

  // ── Get Display Name ────────────────────────────────────────────────────
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

  // ── No Room Selected ────────────────────────────────────────────────────
  if (!activeRoom) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 text-lg font-medium">
        Select a room to start chatting
      </div>
    );
  }

  // ── Main Chat Panel ─────────────────────────────────────────────────────
  return (
    <div className="flex-1 flex flex-col bg-white">
      <div className="px-6 py-4 border-b border-gray-200 font-bold text-base">
        {activeRoom.group ? (
          <>
            <HiUserGroup className="inline mr-2" />
            {getRoomDisplayName(activeRoom)}
          </>
        ) : (
          <>
            <FaEnvelope className="inline mr-2" />
            {getRoomDisplayName(activeRoom)}
          </>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-3 bg-gray-50">
        {(messages || []).map((msg, index) => {
          const isOwn = msg.senderUsername === user?.username;

          return (
            <div
              key={index}
              className={`max-w-[75%] ${isOwn ? "self-end" : "self-start"}`}
            >
              <div
                className={`rounded-md px-3 py-2 shadow-sm ${
                  isOwn ? "bg-blue-600 text-white" : "bg-[#1f1f1f] text-white"
                }`}
              >
                {/* Sender Name */}
                {!isOwn && activeRoom.group && (
                  <div className="text-sm font-semibold text-orange-400 mb-1">
                    {msg.senderUsername}
                  </div>
                )}

                {/* Message + Timestamp in same row */}
                <div className="flex items-end gap-2">
                  <p className="text-sm leading-relaxed break-words flex-1">
                    {msg.content}
                  </p>

                  {/* Timestamp */}
                  <span className="text-xs text-gray-100 whitespace-nowrap self-end">
                    {formatTime(msg.sentAt)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}

        {/* Scroll Target */}
        <div ref={messagesEndRef} />
      </div>

      {/* Typing Indicator */}
      {typingLabel && (
        <div className="px-6 py-2 text-sm text-gray-500">{typingLabel}</div>
      )}

      {/* Message Input */}
      <div className="flex gap-3 px-6 py-4 border-t border-gray-200 bg-white">
        <input
          type="text"
          placeholder={`Message ${getRoomDisplayName(activeRoom)}`}
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSend()}
          className="flex-1 px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        <button
          onClick={onSend}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700"
        >
          Send
        </button>
      </div>
    </div>
  );
}
