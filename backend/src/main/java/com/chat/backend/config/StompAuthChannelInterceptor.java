package com.chat.backend.config;

import com.chat.backend.repository.UserRepository;
import com.chat.backend.security.JwtUtil;
import com.chat.backend.service.RoomAccessService;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Component
@RequiredArgsConstructor
public class StompAuthChannelInterceptor implements ChannelInterceptor {

    private static final Pattern ROOM_TOPIC_PATTERN =
            Pattern.compile("^/topic/(?:room|files)/([0-9a-fA-F-]{36})$");
    private static final Pattern DELETE_TOPIC_PATTERN =
            Pattern.compile("^/topic/messages/([0-9a-fA-F-]{36})/delete$");

    private final JwtUtil jwtUtil;
    private final UserRepository userRepository;
    private final RoomAccessService roomAccessService;

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(message);
        boolean headersUpdated = false;

        if (StompCommand.CONNECT.equals(accessor.getCommand())) {
            accessor.setUser(resolveAuthentication(accessor));
            return withUpdatedHeaders(message, accessor);
        }

        if (StompCommand.SUBSCRIBE.equals(accessor.getCommand())
                || StompCommand.SEND.equals(accessor.getCommand())) {
            headersUpdated = ensureAuthenticated(accessor);
        }

        if (StompCommand.SUBSCRIBE.equals(accessor.getCommand())) {
            String username = requireUsername(accessor);
            UUID roomId = extractRoomId(accessor.getDestination());

            if (roomId != null && !roomAccessService.canAccessRoom(roomId, username)) {
                throw new AccessDeniedException("You do not have access to this room.");
            }
        }

        return headersUpdated ? withUpdatedHeaders(message, accessor) : message;
    }

    private boolean ensureAuthenticated(StompHeaderAccessor accessor) {
        if (accessor.getUser() != null && accessor.getUser().getName() != null) {
            return false;
        }

        accessor.setUser(resolveAuthentication(accessor));
        return true;
    }

    private UsernamePasswordAuthenticationToken resolveAuthentication(StompHeaderAccessor accessor) {
        String authorization = accessor.getFirstNativeHeader("Authorization");

        if (authorization == null || !authorization.startsWith("Bearer ")) {
            throw new AccessDeniedException("Missing Authorization header.");
        }

        String token = authorization.substring(7);

        if (!jwtUtil.isTokenValid(token)) {
            throw new AccessDeniedException("Invalid token.");
        }

        String email = jwtUtil.extractEmail(token);

        return userRepository.findByEmail(email)
                .map(user -> new UsernamePasswordAuthenticationToken(
                        user.getUsername(),
                        null,
                        List.of()
                ))
                .orElseThrow(() -> new AccessDeniedException("User not found."));
    }

    private String requireUsername(StompHeaderAccessor accessor) {
        if (accessor.getUser() == null || accessor.getUser().getName() == null) {
            throw new AccessDeniedException("Authentication is required.");
        }

        return accessor.getUser().getName();
    }

    private UUID extractRoomId(String destination) {
        if (destination == null || destination.isBlank()) {
            return null;
        }

        Matcher roomMatcher = ROOM_TOPIC_PATTERN.matcher(destination);
        if (roomMatcher.matches()) {
            return UUID.fromString(roomMatcher.group(1));
        }

        Matcher deleteMatcher = DELETE_TOPIC_PATTERN.matcher(destination);
        if (deleteMatcher.matches()) {
            return UUID.fromString(deleteMatcher.group(1));
        }

        return null;
    }

    private Message<?> withUpdatedHeaders(Message<?> message, StompHeaderAccessor accessor) {
        return MessageBuilder.createMessage(message.getPayload(), accessor.getMessageHeaders());
    }
}
