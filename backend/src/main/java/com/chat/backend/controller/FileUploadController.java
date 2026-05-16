package com.chat.backend.controller;

import com.chat.backend.model.FileMessage;
import com.chat.backend.model.FileMessage.FileCategory;
import com.chat.backend.repository.FileMessageRepository;
import com.chat.backend.service.FileStorageService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.Resource;
import org.springframework.http.*;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/files")
@RequiredArgsConstructor
@Slf4j
@CrossOrigin(origins = "*")
public class FileUploadController {

    private final FileStorageService     storageService;
    private final FileMessageRepository  fileMessageRepository;
    private final SimpMessagingTemplate  messagingTemplate;

    // ── Upload ────────────────────────────────────────────────────────────────

    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> uploadFile(
            @RequestParam("file")       MultipartFile file,
            @RequestParam("chatRoomId") String chatRoomId,
            @RequestParam("sender")     String sender,
            @RequestParam(value = "caption", required = false) String caption) {

        try {
            // 1. Store the raw bytes
            String storedName  = storageService.store(file);
            String contentType = file.getContentType();
            FileCategory category = storageService.categorize(contentType);

            // 2. Persist metadata
            FileMessage msg = FileMessage.builder()
                    .chatRoomId(chatRoomId)
                    .sender(sender)
                    .originalFileName(file.getOriginalFilename())
                    .storedFileName(storedName)
                    .contentType(contentType)
                    .fileSize(file.getSize())
                    .fileCategory(category)
                    .caption(caption)
                    .build();

            FileMessage saved = fileMessageRepository.save(msg);
            log.info("File uploaded: {} by {} in room {}", file.getOriginalFilename(), sender, chatRoomId);

            // 3. Broadcast over WebSocket so all room members receive the new file bubble
            //    Topic: /topic/files/{chatRoomId}
            messagingTemplate.convertAndSend(
                    "/topic/files/" + chatRoomId,
                    toDto(saved));

            return ResponseEntity.ok(toDto(saved));

        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        } catch (Exception ex) {
            log.error("File upload failed", ex);
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "Upload failed. Please try again."));
        }
    }

    // ── Download / Serve ──────────────────────────────────────────────────────

    @GetMapping("/{storedFileName:.+}")
    public ResponseEntity<Resource> serveFile(
            @PathVariable String storedFileName,
            @RequestParam(value = "originalName", required = false) String originalName) {

        Resource resource = storageService.load(storedFileName);

        // Look up the content-type from the DB record for accuracy
        FileMessage meta = fileMessageRepository
                .findAll()          // small dataset; replace with a proper query if large
                .stream()
                .filter(m -> m.getStoredFileName().equals(storedFileName))
                .findFirst()
                .orElse(null);

        String contentType = (meta != null) ? meta.getContentType() : MediaType.APPLICATION_OCTET_STREAM_VALUE;
        String displayName = (meta != null) ? meta.getOriginalFileName()
                : (originalName != null ? originalName : storedFileName);

        ContentDisposition disposition;
        if (contentType.startsWith("image/")) {
            // Show images inline in the browser / chat preview
            disposition = ContentDisposition.inline().filename(displayName).build();
        } else {
            // Trigger save-file dialog for docs, zips, etc.
            disposition = ContentDisposition.attachment().filename(displayName).build();
        }

        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(contentType))
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition.toString())
                .body(resource);
    }

    // ── History ───────────────────────────────────────────────────────────────

    @GetMapping("/history/{chatRoomId}")
    public ResponseEntity<List<FileMessageDto>> getHistory(@PathVariable String chatRoomId) {
        List<FileMessageDto> history = fileMessageRepository
                .findByChatRoomIdOrderBySentAtAsc(chatRoomId)
                .stream()
                .map(this::toDto)
                .toList();
        return ResponseEntity.ok(history);
    }

    // ── DTO ───────────────────────────────────────────────────────────────────

    private FileMessageDto toDto(FileMessage m) {
        return new FileMessageDto(
                m.getId(),
                m.getChatRoomId(),
                m.getSender(),
                m.getOriginalFileName(),
                "/api/files/" + m.getStoredFileName(),   // downloadUrl
                m.getContentType(),
                m.getFileSize(),
                m.getFileCategory().name(),
                m.getCaption(),
                m.getSentAt().toString()
        );
    }

    /** Lightweight record sent over REST and WebSocket. */
    public record FileMessageDto(
            String id,
            String chatRoomId,
            String sender,
            String originalFileName,
            String downloadUrl,
            String contentType,
            Long   fileSize,
            String fileCategory,   // "IMAGE" | "DOCUMENT" | "ZIP" | "OTHER"
            String caption,
            String sentAt
    ) {}
}
