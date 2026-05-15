package com.chat.backend.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

/**
 * Represents a file/media message sent in a chat.
 * Stored alongside regular ChatMessage; linked by chatRoomId + sender.
 */
@Entity
@Table(name = "file_messages")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FileMessage {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    /** The chat room this file belongs to. */
    @Column(nullable = false)
    private String chatRoomId;

    /** Username of the sender. */
    @Column(nullable = false)
    private String sender;

    /** Original filename as uploaded by the user. */
    @Column(nullable = false)
    private String originalFileName;

    /**
     * Stored filename on disk (UUID-based to avoid collisions).
     * e.g.  "3f2a1b4c-…-invoice.pdf"
     */
    @Column(nullable = false)
    private String storedFileName;

    /** MIME type detected at upload time, e.g. "image/png", "application/zip". */
    @Column(nullable = false)
    private String contentType;

    /** File size in bytes. */
    @Column(nullable = false)
    private Long fileSize;

    /**
     * High-level category used by the frontend to pick the right renderer.
     * One of: IMAGE | DOCUMENT | ZIP | OTHER
     */
    @Column(nullable = false)
    @Enumerated(EnumType.STRING)
    private FileCategory fileCategory;

    /** Optional caption typed by the sender alongside the file. */
    @Column(length = 1000)
    private String caption;

    @Column(nullable = false)
    private LocalDateTime sentAt;

    @PrePersist
    protected void onCreate() {
        sentAt = LocalDateTime.now();
    }

    // ── Category enum ────────────────────────────────────────────────────────

    public enum FileCategory {
        IMAGE,
        DOCUMENT,
        ZIP,
        OTHER
    }
}
