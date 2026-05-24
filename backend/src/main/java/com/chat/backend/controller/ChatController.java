package com.chat.backend.controller;

import com.chat.backend.dto.MessageDTO;
import com.chat.backend.exception.ApiException;
import com.chat.backend.model.ChatRoom;
import com.chat.backend.model.Message;
import com.chat.backend.model.User;
import com.chat.backend.repository.MessageRepository;
import com.chat.backend.service.RoomAccessService;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import java.security.Principal;
import java.time.LocalDateTime;

@Controller
@RequiredArgsConstructor
public class ChatController {

    private final SimpMessagingTemplate messagingTemplate;
    private final MessageRepository messageRepository;
    private final RoomAccessService roomAccessService;

    @MessageMapping("/chat.send")
    public void sendMessage(@Payload MessageDTO messageDTO, Principal principal) {
        String username = roomAccessService.requireUsername(principal);

        if (messageDTO.getRoomId() == null) {
            throw ApiException.badRequest("Room is required.");
        }

        ChatRoom room = roomAccessService.requireAccessibleRoom(messageDTO.getRoomId(), username);

        if ("TYPING".equalsIgnoreCase(messageDTO.getType())
                || "STOP_TYPING".equalsIgnoreCase(messageDTO.getType())) {
            messageDTO.setSenderUsername(username);
            messagingTemplate.convertAndSend("/topic/room/" + messageDTO.getRoomId(), messageDTO);
            return;
        }

        if (messageDTO.getContent() == null || messageDTO.getContent().isBlank()) {
            throw ApiException.badRequest("Message content is required.");
        }

        User sender = roomAccessService.requireUser(username);

        Message message = new Message();
        message.setRoom(room);
        message.setSender(sender);
        message.setContent(messageDTO.getContent().trim());
        message.setSentAt(LocalDateTime.now());
        messageRepository.save(message);

        messageDTO.setId(message.getId());
        messageDTO.setType("CHAT");
        messageDTO.setSenderUsername(username);
        messageDTO.setSentAt(message.getSentAt());
        messageDTO.setContent(message.getContent());
        messagingTemplate.convertAndSend("/topic/room/" + messageDTO.getRoomId(), messageDTO);
    }
}
