package com.chat.backend.service;

import com.chat.backend.exception.ApiException;
import com.chat.backend.model.ChatRoom;
import com.chat.backend.model.User;
import com.chat.backend.repository.ChatRoomRepository;
import com.chat.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.Principal;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class RoomAccessService {

    private final ChatRoomRepository chatRoomRepository;
    private final UserRepository userRepository;

    public String requireUsername(Principal principal) {
        if (principal == null || principal.getName() == null || principal.getName().isBlank()) {
            throw ApiException.unauthorized("Authentication is required.");
        }

        return principal.getName();
    }

    @Transactional(readOnly = true)
    public User requireUser(String username) {
        return userRepository.findByUsername(username)
                .orElseThrow(() -> ApiException.notFound("User not found."));
    }

    @Transactional(readOnly = true)
    public ChatRoom requireAccessibleRoom(UUID roomId, String username) {
        ChatRoom room = chatRoomRepository.findRoomWithMembersById(roomId)
                .orElseThrow(() -> ApiException.notFound("Room not found."));

        if (!canAccessRoom(room, username)) {
            throw ApiException.forbidden("You do not have access to this room.");
        }

        return room;
    }

    @Transactional(readOnly = true)
    public ChatRoom requireManageableGroupRoom(UUID roomId, String username) {
        ChatRoom room = requireAccessibleRoom(roomId, username);

        if (!room.isGroup()) {
            throw ApiException.badRequest("Direct message rooms cannot be deleted or cleared.");
        }

        if (!isRoomMember(room, username)) {
            throw ApiException.forbidden("Only the room creator can manage this room.");
        }

        return room;
    }

    @Transactional(readOnly = true)
    public boolean canAccessRoom(UUID roomId, String username) {
        return chatRoomRepository.findRoomWithMembersById(roomId)
                .map(room -> canAccessRoom(room, username))
                .orElse(false);
    }

    public boolean canAccessRoom(ChatRoom room, String username) {
        if (room.isGroup()) {
            return true;
        }

        return isRoomMember(room, username);
    }

    public boolean isRoomMember(ChatRoom room, String username) {
        return room.getMembers().stream()
                .anyMatch(member -> username.equals(member.getUsername()));
    }
}
