package com.chat.backend.controller;

import com.chat.backend.dto.MessageDTO;
import com.chat.backend.model.ChatRoom;
import com.chat.backend.model.Message;
import com.chat.backend.model.User;
import com.chat.backend.repository.ChatRoomRepository;
import com.chat.backend.repository.MessageRepository;
import com.chat.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import java.time.LocalDateTime;

@Controller
@RequiredArgsConstructor
public class ChatController {

    private final SimpMessagingTemplate messagingTemplate;
    private final MessageRepository messageRepository;
    private final ChatRoomRepository chatRoomRepository;
    private final UserRepository userRepository;

    @MessageMapping("/chat.send")
    public void sendMessage(@Payload MessageDTO messageDTO) {
        if ("TYPING".equalsIgnoreCase(messageDTO.getType())
                || "STOP_TYPING".equalsIgnoreCase(messageDTO.getType())) {
            messagingTemplate.convertAndSend("/topic/room/" + messageDTO.getRoomId(), messageDTO);
            return;
        }

        if (messageDTO.getContent() == null || messageDTO.getContent().isBlank()) {
            return;
        }

        ChatRoom room = chatRoomRepository.findById(messageDTO.getRoomId())
                .orElseThrow(() -> new RuntimeException("Room not found"));

        User sender = userRepository.findByUsername(messageDTO.getSenderUsername())
                .orElseThrow(() -> new RuntimeException("User not found"));

        Message message = new Message();
        message.setRoom(room);
        message.setSender(sender);
        message.setContent(messageDTO.getContent());
        message.setSentAt(LocalDateTime.now());
        messageRepository.save(message);

        messageDTO.setType("CHAT");
        messageDTO.setSentAt(message.getSentAt());
        messagingTemplate.convertAndSend("/topic/room/" + messageDTO.getRoomId(), messageDTO);
    }
}
