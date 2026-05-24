package com.chat.backend.service;

import com.chat.backend.dto.MessageDeleteEvent;
import com.chat.backend.dto.MessageDeleteRequest;
import com.chat.backend.dto.MessageDeleteRequest.DeleteType;
import com.chat.backend.exception.ApiException;
import com.chat.backend.model.FileMessage;
import com.chat.backend.model.Message;
import com.chat.backend.repository.FileMessageRepository;
import com.chat.backend.repository.MessageRepository;

import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.Principal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class MessageDeleteService {

    private final MessageRepository messageRepository;
    private final FileMessageRepository fileMessageRepository;
    private final FileStorageService fileStorageService;
    private final SimpMessagingTemplate messagingTemplate;
    private final RoomAccessService roomAccessService;

    @Transactional
    public MessageDeleteEvent delete(MessageDeleteRequest request, Principal principal) {
        String requestingUser = roomAccessService.requireUsername(principal);
        UUID roomId = parseRoomId(request.getChatRoomId());
        roomAccessService.requireAccessibleRoom(roomId, requestingUser);

        List<String> processedIds = new ArrayList<>();

        for (String messageId : request.getMessageIds()) {
            if (isNumericId(messageId)) {
                Long parsedMessageId = Long.valueOf(messageId);
                Message message = messageRepository.findById(parsedMessageId)
                        .orElseThrow(() -> ApiException.notFound("Message not found: " + messageId));

                if (!roomId.equals(message.getRoom().getId())) {
                    throw ApiException.badRequest("One or more selected messages do not belong to this room.");
                }

                if (request.getDeleteType() == DeleteType.FOR_ME) {
                    deleteForMe(message, requestingUser);
                } else {
                    deleteForEveryone(message, requestingUser);
                }

                messageRepository.save(message);
                processedIds.add(String.valueOf(parsedMessageId));
                continue;
            }

            FileMessage fileMessage = fileMessageRepository.findById(messageId)
                    .orElseThrow(() -> ApiException.notFound("File message not found: " + messageId));

            if (!roomId.toString().equals(fileMessage.getChatRoomId())) {
                throw ApiException.badRequest("One or more selected messages do not belong to this room.");
            }

            if (request.getDeleteType() == DeleteType.FOR_ME) {
                deleteForMe(fileMessage, requestingUser);
            } else {
                deleteForEveryone(fileMessage, requestingUser);
            }

            fileMessageRepository.save(fileMessage);
            processedIds.add(fileMessage.getId());
        }

        MessageDeleteEvent event = new MessageDeleteEvent(
                processedIds,
                request.getDeleteType().name(),
                requestingUser,
                request.getChatRoomId());

        messagingTemplate.convertAndSend(
                "/topic/messages/" + request.getChatRoomId() + "/delete",
                event);

        return event;
    }

    private UUID parseRoomId(String roomId) {
        try {
            return UUID.fromString(roomId);
        } catch (IllegalArgumentException exception) {
            throw ApiException.badRequest("Invalid room id.");
        }
    }

    private boolean isNumericId(String messageId) {
        try {
            Long.valueOf(messageId);
            return true;
        } catch (NumberFormatException exception) {
            return false;
        }
    }

    private void deleteForMe(Message message, String username) {
        message.getDeletedBy().add(username);
    }

    private void deleteForEveryone(Message message, String requestingUser) {
        if (!message.canDeleteForEveryone(requestingUser)) {
            throw ApiException.forbidden("You can only delete your own messages for everyone.");
        }

        message.setDeletedForEveryone(true);
        message.setContent("");
        message.setDeletedAt(LocalDateTime.now());
    }

    private void deleteForMe(FileMessage fileMessage, String username) {
        fileMessage.getDeletedBy().add(username);
    }

    private void deleteForEveryone(FileMessage fileMessage, String requestingUser) {
        if (!fileMessage.canDeleteForEveryone(requestingUser)) {
            throw ApiException.forbidden("You can only delete your own messages for everyone.");
        }

        fileMessage.setDeletedForEveryone(true);
        fileMessage.setDeletedAt(LocalDateTime.now());
        fileStorageService.delete(fileMessage.getStoredFileName());
    }
}
