package com.chat.backend.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;

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
     * e.g. "3f2a1b4c-…-invoice.pdf"
     */
    @Column(nullable = false)
    private String storedFileName;

    /** MIME type detected at upload time, e.g. "image/png", "application/zip". */
    @Column(nullable = false)
    private String contentType;

    /** File size in bytes. */
    @Column(nullable = false)
    private Long fileSize;

    @Column(nullable = false)
    @Enumerated(EnumType.STRING)
    private FileCategory fileCategory;

    /** Optional caption typed by the sender alongside the file. */
    @Column(length = 1000)
    private String caption;

    @Column(nullable = false)
    private LocalDateTime sentAt;

    @Column(nullable = false, columnDefinition = "boolean default false")
    private boolean deletedForEveryone = false;

    @Column
    private LocalDateTime deletedAt;

    @Builder.Default
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "file_message_deleted_by", joinColumns = @JoinColumn(name = "file_message_id"))
    @Column(name = "username")
    private Set<String> deletedBy = new HashSet<>();

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

    public boolean isDeletedForUser(String username) {
        return deletedForEveryone || deletedBy.contains(username);
    }

    public boolean canDeleteForEveryone(String requestingUser) {
        return sender != null
                && sender.equals(requestingUser);
    }
}
