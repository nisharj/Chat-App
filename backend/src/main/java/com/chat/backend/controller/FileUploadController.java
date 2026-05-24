package com.chat.backend.controller;

import com.chat.backend.exception.ApiException;
import com.chat.backend.model.FileMessage;
import com.chat.backend.model.FileMessage.FileCategory;
import com.chat.backend.repository.FileMessageRepository;
import com.chat.backend.service.FileStorageService;
import com.chat.backend.service.RoomAccessService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.Resource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.security.Principal;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/files")
@RequiredArgsConstructor
@Slf4j
@CrossOrigin(origins = "*")
public class FileUploadController {

        private final FileStorageService storageService;
        private final FileMessageRepository fileMessageRepository;
        private final SimpMessagingTemplate messagingTemplate;
        private final RoomAccessService roomAccessService;

        @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
        public FileMessageDto uploadFile(
                        @RequestParam("file") MultipartFile file,
                        @RequestParam("chatRoomId") String chatRoomId,
                        @RequestParam(value = "caption", required = false) String caption,
                        Principal principal) {
                String username = roomAccessService.requireUsername(principal);
                UUID roomId = parseRoomId(chatRoomId);

                roomAccessService.requireAccessibleRoom(roomId, username);

                String storedName = storageService.store(file);
                String contentType = file.getContentType();
                FileCategory category = storageService.categorize(contentType);

                FileMessage fileMessage = FileMessage.builder()
                                .chatRoomId(chatRoomId)
                                .sender(username)
                                .originalFileName(file.getOriginalFilename())
                                .storedFileName(storedName)
                                .contentType(contentType)
                                .fileSize(file.getSize())
                                .fileCategory(category)
                                .caption(caption == null ? null : caption.trim())
                                .build();

                FileMessage saved = fileMessageRepository.save(fileMessage);
                log.info("File uploaded: {} by {} in room {}", file.getOriginalFilename(), username, chatRoomId);

                FileMessageDto dto = toDto(saved);
                messagingTemplate.convertAndSend("/topic/files/" + chatRoomId, dto);
                return dto;
        }

        @GetMapping("/{storedFileName:.+}")
        public ResponseEntity<Resource> serveFile(
                        @PathVariable String storedFileName,
                        Principal principal) {
                String username = roomAccessService.requireUsername(principal);
                FileMessage metadata = fileMessageRepository.findByStoredFileName(storedFileName)
                                .orElseThrow(() -> ApiException.notFound("File not found."));

                if (metadata.isDeletedForUser(username)) {
                        throw ApiException.notFound("File not found.");
                }

                roomAccessService.requireAccessibleRoom(parseRoomId(metadata.getChatRoomId()), username);

                Resource resource = storageService.load(storedFileName);
                String contentType = metadata.getContentType();
                String displayName = metadata.getOriginalFileName();

                ContentDisposition disposition = contentType.startsWith("image/")
                                ? ContentDisposition.inline().filename(displayName).build()
                                : ContentDisposition.attachment().filename(displayName).build();

                return ResponseEntity.ok()
                                .contentType(MediaType.parseMediaType(contentType))
                                .header(HttpHeaders.CONTENT_DISPOSITION, disposition.toString())
                                .body(resource);
        }

        @GetMapping("/history/{chatRoomId}")
        public List<FileMessageDto> getHistory(@PathVariable String chatRoomId, Principal principal) {
                String username = roomAccessService.requireUsername(principal);
                roomAccessService.requireAccessibleRoom(parseRoomId(chatRoomId), username);

                return fileMessageRepository.findByChatRoomIdOrderBySentAtAsc(chatRoomId).stream()
                                .filter(fileMessage -> !fileMessage.isDeletedForUser(username))
                                .map(this::toDto)
                                .toList();
        }

        private UUID parseRoomId(String roomId) {
                try {
                        return UUID.fromString(roomId);
                } catch (IllegalArgumentException exception) {
                        throw ApiException.badRequest("Invalid room id.");
                }
        }

        private FileMessageDto toDto(FileMessage fileMessage) {
                return new FileMessageDto(
                                fileMessage.getId(),
                                fileMessage.getChatRoomId(),
                                fileMessage.getSender(),
                                fileMessage.getOriginalFileName(),
                                "/api/files/" + fileMessage.getStoredFileName(),
                                fileMessage.getContentType(),
                                fileMessage.getFileSize(),
                                fileMessage.getFileCategory().name(),
                                fileMessage.getCaption(),
                                fileMessage.getSentAt().toString());
        }

        public record FileMessageDto(
                        String id,
                        String chatRoomId,
                        String sender,
                        String originalFileName,
                        String downloadUrl,
                        String contentType,
                        Long fileSize,
                        String fileCategory,
                        String caption,
                        String sentAt) {
        }
}
