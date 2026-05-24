package com.chat.backend.dto;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.List;


@Data
public class MessageDeleteRequest {

    @NotEmpty(message = "At least one message ID is required.")
    private List<String> messageIds;

    @NotNull(message = "deleteType is required.")
    private DeleteType deleteType;

    /** Used to broadcast the deletion event to the correct WebSocket topic. */
    @NotBlank(message = "chatRoomId is required.")
    private String chatRoomId;

    public enum DeleteType {
        FOR_ME,
        FOR_EVERYONE
    }
}
