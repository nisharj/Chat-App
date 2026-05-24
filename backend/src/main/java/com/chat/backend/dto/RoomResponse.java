package com.chat.backend.dto;

import java.time.LocalDateTime;
import java.util.UUID;

public record RoomResponse(
        UUID id,
        String name,
        boolean group,
        LocalDateTime createdAt,
        boolean canManage
) {
}
