package com.chat.backend.controller;

import com.chat.backend.model.ChatRoom;
import com.chat.backend.model.Message;
import com.chat.backend.repository.ChatRoomRepository;
import com.chat.backend.repository.MessageRepository;
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
}
