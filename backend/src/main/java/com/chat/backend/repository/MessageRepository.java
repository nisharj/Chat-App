package com.chat.backend.repository;

import com.chat.backend.model.Message;
import io.lettuce.core.dynamic.annotation.Param;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.UUID;

public interface MessageRepository extends JpaRepository<Message, UUID> {
    @Query("SELECT m FROM Message m WHERE m.room.id = :roomId ORDER BY m.sentAt ASC")
    List<Message> findMessagesByRoomId(@Param("roomId") UUID roomId);
}
