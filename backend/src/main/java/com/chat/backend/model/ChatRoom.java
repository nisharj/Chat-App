package com.chat.backend.model;

import io.lettuce.core.dynamic.annotation.CommandNaming;
import jakarta.persistence.*;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Entity
@Table
public class ChatRoom {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    private String name;
    private boolean isGroup = false;
    private LocalDateTime createdAt = LocalDateTime.now();
}
