package com.chat.backend.controller;

import com.chat.backend.dto.MessageDTO;
import com.chat.backend.dto.RoomResponse;
import com.chat.backend.dto.UserSummaryResponse;
import com.chat.backend.exception.ApiException;
import com.chat.backend.model.ChatRoom;
import com.chat.backend.model.Message;
import com.chat.backend.model.User;
import com.chat.backend.repository.ChatRoomRepository;
import com.chat.backend.repository.MessageRepository;
import com.chat.backend.repository.UserRepository;
import com.chat.backend.service.PresenceService;
import com.chat.backend.service.RoomAccessService;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.Comparator;
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
    private final RoomAccessService roomAccessService;

    @PostMapping("/api/rooms")
    public RoomResponse createRoom(
            @RequestParam String name,
            @RequestParam boolean isGroup,
            Principal principal
    ) {
        String username = roomAccessService.requireUsername(principal);
        String trimmedName = name == null ? "" : name.trim();

        if (!isGroup) {
            throw ApiException.badRequest("Use the direct message action for private chats.");
        }

        if (trimmedName.isBlank()) {
            throw ApiException.badRequest("Room name is required.");
        }

        if (trimmedName.startsWith("dm_")) {
            throw ApiException.badRequest("Room names cannot start with dm_.");
        }

        if (chatRoomRepository.findByName(trimmedName).isPresent()) {
            throw ApiException.badRequest("A room with that name already exists.");
        }

        User creator = roomAccessService.requireUser(username);

        ChatRoom room = new ChatRoom();
        room.setName(trimmedName);
        room.setGroup(true);
        room.getMembers().add(creator);

        return toRoomResponse(chatRoomRepository.save(room), username);
    }

    @GetMapping("/api/rooms")
    public List<RoomResponse> getAllRooms(Principal principal) {
        String username = roomAccessService.requireUsername(principal);

        return chatRoomRepository.findVisibleRooms(username).stream()
                .map(room -> toRoomResponse(room, username))
                .toList();
    }

    @GetMapping("/api/messages/{roomId}")
    public List<MessageDTO> getMessages(
            @PathVariable UUID roomId,
            Principal principal
    ) {
        String username = roomAccessService.requireUsername(principal);
        roomAccessService.requireAccessibleRoom(roomId, username);

        return messageRepository.findVisibleMessages(roomId, username).stream()
                .map(this::toMessageDto)
                .toList();
    }

    @PostMapping("/api/presence/online")
    public void setOnline(Principal principal) {
        presenceService.setOnline(roomAccessService.requireUsername(principal));
    }

    @GetMapping("/api/presence/{username}")
    public boolean isOnline(@PathVariable String username) {
        return presenceService.isOnline(username);
    }

    @GetMapping("/api/users")
    public List<UserSummaryResponse> getAllUsers() {
        return userRepository.findAll().stream()
                .sorted(Comparator.comparing(User::getUsername, String.CASE_INSENSITIVE_ORDER))
                .map(user -> new UserSummaryResponse(user.getId(), user.getUsername(), user.getAvatarUrl()))
                .toList();
    }

    @PostMapping("/api/rooms/direct")
    public RoomResponse getOrCreateDirectRoom(
            @RequestParam String targetUsername,
            Principal principal
    ) {
        String currentUsername = roomAccessService.requireUsername(principal);
        String normalizedTarget = targetUsername == null ? "" : targetUsername.trim();

        if (normalizedTarget.isBlank()) {
            throw ApiException.badRequest("Target username is required.");
        }

        if (currentUsername.equals(normalizedTarget)) {
            throw ApiException.badRequest("You cannot create a direct message with yourself.");
        }

        User currentUser = roomAccessService.requireUser(currentUsername);
        User targetUser = roomAccessService.requireUser(normalizedTarget);
        String roomName = buildDirectRoomName(currentUsername, normalizedTarget);

        ChatRoom room = chatRoomRepository.findRoomWithMembersByName(roomName)
                .map(existingRoom -> ensureDirectRoomMembers(existingRoom, currentUser, targetUser))
                .orElseGet(() -> createDirectRoom(roomName, currentUser, targetUser));

        return toRoomResponse(room, currentUsername);
    }

    @Transactional
    @DeleteMapping("/api/rooms/{roomId}")
    public ResponseEntity<Void> deleteRoom(@PathVariable UUID roomId, Principal principal) {
        String username = roomAccessService.requireUsername(principal);
        roomAccessService.requireManageableGroupRoom(roomId, username);

        messageRepository.deleteByRoomId(roomId);
        chatRoomRepository.deleteById(roomId);

        return ResponseEntity.noContent().build();
    }

    @Transactional
    @DeleteMapping("/api/rooms/{roomId}/message")
    public ResponseEntity<Void> clearMessage(@PathVariable UUID roomId, Principal principal) {
        String username = roomAccessService.requireUsername(principal);
        roomAccessService.requireManageableGroupRoom(roomId, username);

        messageRepository.deleteByRoomId(roomId);
        return ResponseEntity.noContent().build();
    }

    private ChatRoom createDirectRoom(String roomName, User currentUser, User targetUser) {
        ChatRoom room = new ChatRoom();
        room.setGroup(false);
        room.setName(roomName);
        room.getMembers().add(currentUser);
        room.getMembers().add(targetUser);
        return chatRoomRepository.save(room);
    }

    private ChatRoom ensureDirectRoomMembers(ChatRoom room, User currentUser, User targetUser) {
        if (room.isGroup()) {
            throw ApiException.badRequest("A group room already uses this direct message identifier.");
        }

        boolean changed = room.getMembers().add(currentUser);
        changed |= room.getMembers().add(targetUser);

        return changed ? chatRoomRepository.save(room) : room;
    }

    private String buildDirectRoomName(String firstUsername, String secondUsername) {
        List<String> sortedUsernames = List.of(firstUsername, secondUsername).stream()
                .sorted(String.CASE_INSENSITIVE_ORDER)
                .toList();

        return "dm_" + sortedUsernames.get(0) + "_" + sortedUsernames.get(1);
    }

    private RoomResponse toRoomResponse(ChatRoom room, String username) {
        boolean canManage = room.isGroup() && roomAccessService.isRoomMember(room, username);

        return new RoomResponse(
                room.getId(),
                room.getName(),
                room.isGroup(),
                room.getCreatedAt(),
                canManage
        );
    }

    private MessageDTO toMessageDto(Message message) {
        MessageDTO dto = new MessageDTO();
        dto.setId(message.getId());
        dto.setType("CHAT");
        dto.setRoomId(message.getRoom().getId());
        dto.setSenderUsername(message.getSender().getUsername());
        dto.setContent(message.getContent());
        dto.setSentAt(message.getSentAt());
        return dto;
    }
}
