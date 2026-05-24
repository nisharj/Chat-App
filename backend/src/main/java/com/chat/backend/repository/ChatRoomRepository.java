package com.chat.backend.repository;

import com.chat.backend.model.ChatRoom;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ChatRoomRepository extends JpaRepository<ChatRoom, UUID> {
    Optional<ChatRoom> findByName(String name);
    void deleteById(UUID roomId);

    @EntityGraph(attributePaths = "members")
    @Query("""
        SELECT DISTINCT r
        FROM ChatRoom r
        LEFT JOIN r.members m
        WHERE r.isGroup = true OR m.username = :username
        ORDER BY r.createdAt DESC
    """)
    List<ChatRoom> findVisibleRooms(@Param("username") String username);

    @EntityGraph(attributePaths = "members")
    @Query("""
        SELECT r
        FROM ChatRoom r
        WHERE r.id = :roomId
    """)
    Optional<ChatRoom> findRoomWithMembersById(@Param("roomId") UUID roomId);

    @EntityGraph(attributePaths = "members")
    @Query("""
        SELECT r
        FROM ChatRoom r
        WHERE r.name = :name
    """)
    Optional<ChatRoom> findRoomWithMembersByName(@Param("name") String name);
}
