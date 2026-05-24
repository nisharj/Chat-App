import { useEffect, useState } from "react";
import api, { getApiErrorMessage } from "../../../services/api";

const deduplicateRooms = (rooms) =>
  (rooms ?? []).filter(
    (room, index, allRooms) => index === allRooms.findIndex((item) => item.id === room.id),
  );

export default function useRoomDirectory({
  user,
  rooms,
  activeRoom,
  setRooms,
  setActiveRoom,
  setMessages,
}) {
  const [newRoom, setNewRoom] = useState("");
  const [users, setUsers] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState({});
  const [directoryError, setDirectoryError] = useState("");

  useEffect(() => {
    if (!user) return undefined;

    let ignore = false;

    const loadUsers = async () => {
      try {
        const response = await api.get("/api/users");
        if (ignore) return;

        setUsers(response.data ?? []);
      } catch (error) {
        if (ignore) return;
        setDirectoryError(
          getApiErrorMessage(error, "Could not load the user directory."),
        );
      }
    };

    loadUsers();

    return () => {
      ignore = true;
    };
  }, [user]);

  useEffect(() => {
    if (!user) return undefined;

    let ignore = false;

    const fetchRooms = async () => {
      try {
        const response = await api.get("/api/rooms");
        if (ignore) return;

        const uniqueRooms = deduplicateRooms(response.data);
        setRooms(uniqueRooms);
        setDirectoryError("");
      } catch (error) {
        if (ignore) return;
        setDirectoryError(
          getApiErrorMessage(error, "Could not load your rooms."),
        );
      }
    };

    fetchRooms();

    return () => {
      ignore = true;
    };
  }, [user, setRooms]);

  useEffect(() => {
    if (!activeRoom) return;

    if (!(rooms ?? []).some((room) => room.id === activeRoom.id)) {
      setActiveRoom(null);
      setMessages([]);
    }
  }, [activeRoom, rooms, setActiveRoom, setMessages]);

  useEffect(() => {
    if (users.length === 0) return undefined;

    let ignore = false;

    const fetchPresence = async () => {
      const results = await Promise.all(
        users.map(async (directoryUser) => {
          try {
            const response = await api.get(`/api/presence/${directoryUser.username}`);
            return {
              username: directoryUser.username,
              online: response.data,
            };
          } catch {
            return { username: directoryUser.username, online: false };
          }
        }),
      );

      if (ignore) return;

      setOnlineUsers(
        Object.fromEntries(
          results.map(({ username, online }) => [username, online]),
        ),
      );
    };

    fetchPresence();
    const interval = setInterval(fetchPresence, 10000);

    return () => {
      ignore = true;
      clearInterval(interval);
    };
  }, [users]);

  const createRoom = async () => {
    const trimmedName = newRoom.trim();
    if (!trimmedName) return;

    try {
      const response = await api.post("/api/rooms", null, {
        params: {
          name: trimmedName,
          isGroup: true,
        },
      });

      const updatedRooms = deduplicateRooms([...(rooms ?? []), response.data]);
      setRooms(updatedRooms);
      setNewRoom("");
      setDirectoryError("");
    } catch (error) {
      setDirectoryError(
        getApiErrorMessage(error, "Could not create the room."),
      );
    }
  };

  const deleteRoom = async (roomId) => {
    if (!window.confirm("Delete this room and all its messages?")) return;

    try {
      await api.delete(`/api/rooms/${roomId}`);

      const updatedRooms = (rooms ?? []).filter((room) => room.id !== roomId);
      setRooms(updatedRooms);
      setDirectoryError("");

      if (activeRoom?.id === roomId) {
        setActiveRoom(null);
        setMessages([]);
      }
    } catch (error) {
      setDirectoryError(
        getApiErrorMessage(error, "Could not delete the room."),
      );
    }
  };

  const openDirectMessage = async (targetUsername) => {
    if (!targetUsername || targetUsername === user?.username) return;

    try {
      const response = await api.post("/api/rooms/direct", null, {
        params: { targetUsername },
      });

      const updatedRooms = deduplicateRooms([...(rooms ?? []), response.data]);
      setRooms(updatedRooms);
      setActiveRoom(response.data);
      setDirectoryError("");
    } catch (error) {
      setDirectoryError(
        getApiErrorMessage(error, "Could not open that direct message."),
      );
    }
  };

  const groupRooms = Array.isArray(rooms)
    ? rooms.filter((room) => room.group)
    : [];

  const dmRooms = Array.isArray(rooms)
    ? rooms.filter((room) => !room.group)
    : [];

  return {
    newRoom,
    setNewRoom,
    users,
    onlineUsers,
    groupRooms,
    dmRooms,
    directoryError,
    createRoom,
    deleteRoom,
    openDirectMessage,
  };
}
