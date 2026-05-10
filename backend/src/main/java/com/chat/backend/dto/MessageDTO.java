package com.chat.backend.dto;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
public class MessageDTO {
    private String type;
    private UUID roomId;
    private String senderUsername;
    private String content;
    private LocalDateTime sentAt;
}
