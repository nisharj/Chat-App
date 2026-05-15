import { useState } from "react";
import { FaUser, FaEnvelope, FaPlus } from "react-icons/fa";
import { HiUserGroup, HiChatBubbleLeftRight, HiTrash } from "react-icons/hi2";

export default function Sidebar({
  user,
  activeRoom,
  newRoom,
  setNewRoom,
  users,
  onlineUsers,
  groupRooms,
  dmRooms,
  onCreateRoom,
  onDeleteRoom,
  onSelectRoom,
  onOpenDirectMessage,
  onLogout,
}) {
  
  const [hoveredRoom, setHoveredRoom] = useState(null);

  // Display room name
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

  // Reusable room item
  const RoomItem = ({ room, icon }) => {
    const isActive = activeRoom?.id === room.id;
    const isHovered = hoveredRoom === room.id;

    return (
      <div onClick={() => onSelectRoom(room)}
        onMouseEnter={() => setHoveredRoom(room.id)}
        onMouseLeave={() => setHoveredRoom(null)}
        className={`flex items-center justify-between px-4 py-2 rounded-lg cursor-pointer mb-1 ransition-color ${isActive ? "bg-blue-100 text-blue-600 font-semibold" : "text-gray-600 hover:bg-gray-100"}`}
      >
        <span className="flex items-center gap-2 truncate">
          {icon} {getRoomDisplayName(room)}
        </span>

        {isHovered && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDeleteRoom(room.id);
            }}
            className="text-sm opacity-60 hover:opacity-100"
            title="Delete room"
          >
            <HiTrash />
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="w-72 bg-white border-r border-gray-200 flex flex-col overflow-y-auto shadow-sm">
      
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-5 border-b border-gray-100">
        <span className="text-blue-600 font-bold text-lg">
          <HiChatBubbleLeftRight className="inline mr-2" /> ChatApp
        </span>

        {/* <button */}
        <button
          onClick={onLogout}
          className="group relative flex h-7 w-7 items-center justify-center overflow-hidden rounded-md border border-pink-500 bg-transparent text-pink-500 shadow-sm transition-all duration-300 hover:w-16 hover:bg-pink-100 active:translate-x-[2px] active:translate-y-[2px]"
        >
        
          <div className="absolute left-2 flex items-center justify-center transition-transform duration-300 group-hover:-translate-x-1">
            <svg
              viewBox="0 0 512 512"
              className="h-3 w-3 fill-current"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M377.9 105.9L500.7 228.7c7.2 7.2 11.3 17.1 11.3 27.3s-4.1 20.1-11.3 27.3L377.9 406.1c-6.4 6.4-15 9.9-24 9.9c-18.7 0-33.9-15.2-33.9-33.9v-62.1h-128c-17.7 0-32-14.3-32-32v-64c0-17.7 14.3-32 32-32h128v-62.1c0-18.7 15.2-33.9 33.9-33.9c9 0 17.6 3.6 24 9.9zM160 96H96c-17.7 0-32 14.3-32 32v256c0 17.7 14.3 32 32 32h64c17.7 0 32 14.3 32 32s-14.3 32-32 32H96C43 480 0 437 0 384V128C0 75 43 32 96 32h64c17.7 0 32 14.3 32 32s-14.3 32-32 32z" />
            </svg>
          </div>

          <span className="absolute left-6 w-0 overflow-hidden whitespace-nowrap opacity-0 text-[10px] font-semibold transition-all duration-300 group-hover:w-10 group-hover:opacity-100">
            Logout
          </span>
        </button>
      </div>

      {/* User Info */}
      <div className="px-4 py-3 text-sm text-gray-600 bg-gray-50 border-b border-gray-100">
        <FaUser className="inline mr-2" /> {user?.username}
      </div>

      {/* Create Room */}
      <div className="p-4 flex gap-2">
        <input
          type="text"
          placeholder="New room name..."
          value={newRoom}
          onChange={(e) => setNewRoom(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onCreateRoom()}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-sm"
        />

        <button
          onClick={onCreateRoom}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700"
        >
          <FaPlus />
        </button>
      </div>

      {/* Channels */}
      <div className="px-4 pt-3 pb-2 text-xs font-bold text-gray-400 uppercase">
        Channels
      </div>

      <div className="px-2 min-h-[2rem]">
        {groupRooms.map((room) => (
          <RoomItem key={room.id} room={room} icon={<HiUserGroup />} />
        ))}
      </div>

      {/* Recent DMs */}
      <div className="px-4 pt-3 pb-2 text-xs font-bold text-gray-400 uppercase">
        Recent DMs
      </div>

      <div className="px-2 min-h-[2rem]">
        {dmRooms.map((room) => (
          <RoomItem key={room.id} room={room} icon={<FaEnvelope />} />
        ))}
      </div>

      {/* Direct Messages */}
      <div className="px-4 pt-3 pb-2 text-xs font-bold text-gray-400 uppercase">
        Direct Messages
      </div>

      <div className="px-2 pb-4 min-h-[2rem]">
        {users
          .filter((u) => u.username !== user?.username)
          .map((u) => (
            <div
              key={u.id}
              onClick={() => onOpenDirectMessage(u.username)}
              className="flex items-center px-4 py-2 rounded-lg cursor-pointer text-gray-600 hover:bg-gray-100 mb-1"
            >
              <span
                className={`w-2 h-2 rounded-full mr-2 flex-shrink-0 ${
                  onlineUsers[u.username] ? "bg-green-500" : "bg-gray-300"
                }`}
                title={onlineUsers[u.username] ? "Online" : "Offline"}
              />

              {u.username}
            </div>
          ))}
      </div>
    </div>
  );
}
