import { useEffect, useState } from "react";
import api from "../../../services/api";

export default function useRoomDirectory({
  user,
  rooms,
  activeRoom,
  setRooms,
  setActiveRoom,
  setMessages,
}) {
  // ── Local State ──────────────────────────────────────────────────────────
  const [newRoom, setNewRoom] = useState("");
  const [users, setUsers] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState({});

  // ── Load Users ───────────────────────────────────────────────────────────
  useEffect(() => {
    api.get("/api/users").then((res) => {
      setUsers(res.data);
    });
  }, []);

  // ── Load Rooms ───────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchRooms = async() => {
        try{
            const res = await api.get("/api/rooms");
            const unique = res.data.filter(
                (room, index, self) =>
                index === self.findIndex((r) => r.id === room.id)
            );
            setRooms(unique);
        }
        catch(err){
            console.error("Failed to fetch rooms:", err);
        }
    };
    
    fetchRooms();
  },[]);

  // ── Poll Online Presence Every 15 Seconds ────────────────────────────────
  useEffect(() => {
    if (users.length === 0) return;

    const fetchPresence = async () => {
      const results = await Promise.all(
        users.map(async (u) => {
          try {
            const res = await api.get(`/api/presence/${u.username}`);
            return {
              username: u.username,
              online: res.data,
            };
          } 
          catch {
            return { username: u.username, online: false };
          }
        })
      );

      setOnlineUsers(
        Object.fromEntries(
          results.map(({ username, online }) => [username, online])
        )
      );
    };

    fetchPresence();

    const interval = setInterval(fetchPresence, 10000);

    return () => clearInterval(interval);
  }, [users]);

  // ── Create Room ──────────────────────────────────────────────────────────
    const createRoom = async() => {
        if(!newRoom.trim()) return;

        try{
            const res = await api.post(`/api/rooms?name=${encodeURIComponent(newRoom)}&isGroup=true`);

            {/* setRooms((prev) => {
                if(prev.some((room) => room.id === res.data.id)){ return prev; }
                return [...prev, res.data];
             }); */}

            const alreadyExists = rooms.some((r) => r.id === res.data.id);
            if(!alreadyExists) setRooms([...rooms, res.data]);

            setNewRoom("");
        }
        catch(err){
            console.error("Failed to create room:", err);
        }
    }

  // ── Delete Room ──────────────────────────────────────────────────────────
    const deleteRoom = async (roomId) => {
        if (!window.confirm("Delete this room and all its messages?")) return;

        try {
            await api.delete(`/api/rooms/${roomId}`);

            const updatedRooms =  rooms.filter((room) => room.id !== roomId);
            setRooms(updatedRooms);

            if (activeRoom?.id === roomId) {
                setActiveRoom(null);
                setMessages([]);
                
                // const nextRoom = updatedRooms[0] ?? null;
                // setActiveRoom(nextRoom);
                // if (!nextRoom) {
                //     setMessages([]);
                // }
            }
        } 
        catch (err) {
            console.error("Failed to delete room:", err);
        }
    };

  // ── Open Direct Message ──────────────────────────────────────────────────
    const openDirectMessage = async (targetUsername) => {
        if (targetUsername === user?.username) return;

        try{
            const res = await api.post(
            `/api/rooms/direct?user1=${user.username}&user2=${targetUsername}`
            );
        
            {/*
            setRooms((prev) =>
            prev.find((room) => room.id === res.data.id)
                ? prev
                : [...prev, res.data]
            );
            */}

            const alreadyExists = rooms.some((r) => r.id === res.data.id);
            if(!alreadyExists) setRooms([...rooms, res.data]);
        
            setActiveRoom(res.data);
        }
        catch(err){
            console.error("Failed to open DM:", err);
        }
    };

  // ── Derived State ────────────────────────────────────────────────────────
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
        createRoom,
        deleteRoom,
        openDirectMessage,
    };
}