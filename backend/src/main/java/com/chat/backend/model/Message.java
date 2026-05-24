package com.chat.backend.model;

import jakarta.persistence.*;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;

@Data
@Entity
@Table(name = "message")
public class Message {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "room_id", nullable = false)
    private ChatRoom room;

    @ManyToOne
    @JoinColumn(name = "user_id", nullable = false)
    private User sender;

    @Column
    private String content;

    private LocalDateTime sentAt = LocalDateTime.now();
    private boolean isRead = false;

    @Column(nullable = false, columnDefinition = "boolean default false")
    private boolean deletedForEveryone = false;


    @Column
    private LocalDateTime deletedAt;

    public boolean isDeletedForUser(String username) {
        return deletedForEveryone || deletedBy.contains(username);
    }

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(
            name="message_deleted_by",
            joinColumns = @JoinColumn(name = "message_id")
    )
    @Column(name="username")
    private Set<String> deletedBy = new HashSet<>();

    public boolean canDeleteForEveryone(String requestingUser) {
        return sender != null
                && sender.getUsername() != null
                && sender.getUsername().equals(requestingUser);
    }
}
