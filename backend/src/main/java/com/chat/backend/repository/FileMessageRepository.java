package com.chat.backend.repository;

import com.chat.backend.model.FileMessage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface FileMessageRepository extends JpaRepository<FileMessage, String> {
    List<FileMessage> findByChatRoomIdOrderBySentAtAsc(String chatRoomId);
    Optional<FileMessage> findByStoredFileName(String storedFileName);
}
