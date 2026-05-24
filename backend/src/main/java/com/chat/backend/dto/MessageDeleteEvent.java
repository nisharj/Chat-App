package com.chat.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class MessageDeleteEvent {
    private List<String> messageIds;
    private String deleteType;
    private String initiatedBy;
    private String chatRoomId;
}
