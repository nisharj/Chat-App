package com.chat.backend.controller;

import com.chat.backend.model.ChatRoom;
import com.chat.backend.model.Message;
import com.chat.backend.model.User;
import com.chat.backend.repository.ChatRoomRepository;
import com.chat.backend.repository.MessageRepository;
import com.chat.backend.repository.UserRepository;
import com.chat.backend.service.PresenceService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class RoomController {

    private final ChatRoomRepository chatRoomRepository;
    private final MessageRepository messageRepository;
    private final PresenceService presenceService;
    private final UserRepository userRepository;

    @PostMapping("/api/rooms")
    public ChatRoom createRoom(@RequestParam String name,
                               @RequestParam boolean isGroup) {
        ChatRoom room = new ChatRoom();
        room.setName(name);
        room.setGroup(isGroup);
        return chatRoomRepository.save(room);
    }

    @GetMapping("/api/rooms")
    public List<ChatRoom> getAllRooms() {
        return chatRoomRepository.findAll();
    }

    @GetMapping("/api/messages/{roomId}")
    public List<Message> getMessages(@PathVariable UUID roomId) {
        return messageRepository.findMessagesByRoomId(roomId);
    }

    @PostMapping("/api/presence/online")
    public void setOnline(@RequestParam String username) {
        presenceService.setOnline(username);
    }

    @GetMapping("/api/presence/{username}")
    public boolean isOnline(@PathVariable String username) {
        return presenceService.isOnline(username);
    }

    @GetMapping("/api/users")
    public List<User> getAllUsers(){
        return userRepository.findAll();
    }

    @PostMapping("/api/rooms/direct")
    public ChatRoom getOrCreateDirectRoom(@RequestParam String user1, @RequestParam String user2){
        String roomName = "dm_" + (user1.compareTo(user2) < 0 ? user1 + "_" + user2 : user2 + "_" + user1);

        return chatRoomRepository.findByName(roomName)
                .orElseGet(() -> {
                    ChatRoom room = new ChatRoom();
                    room.setName(roomName);
                    room.setGroup(false);
                    return chatRoomRepository.save(room);
                });
    }
}