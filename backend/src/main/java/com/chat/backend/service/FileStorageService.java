package com.chat.backend.service;

import com.chat.backend.model.FileMessage.FileCategory;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.net.MalformedURLException;
import java.nio.file.*;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

@Service
@Slf4j
public class FileStorageService {

    // ── Allowed MIME types ────────────────────────────────────────────────────

    private static final Set<String> ALLOWED_TYPES = Set.of(
            // Images
            "image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml",
            // Documents
            "application/pdf",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/vnd.ms-excel",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "application/vnd.ms-powerpoint",
            "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            "text/plain", "text/csv",
            // Archives
            "application/zip",
            "application/x-zip-compressed",
            "application/x-tar",
            "application/gzip",
            "application/x-7z-compressed",
            "application/x-rar-compressed");

    /** 20 MB default — override via application.properties */
    private static final long MAX_FILE_SIZE = 20 * 1024 * 1024;

    private final Path uploadDir;

    public FileStorageService(@Value("${file.upload-dir:uploads}") String uploadDir) {
        this.uploadDir = Paths.get(uploadDir).toAbsolutePath().normalize();
        try {
            Files.createDirectories(this.uploadDir);
        } catch (IOException ex) {
            throw new RuntimeException("Could not create upload directory: " + uploadDir, ex);
        }
    }

    // ── Public API ────────────────────────────────────────────────────────────

    /**
     * Validates and stores the given file, returning the generated stored filename.
     *
     * @throws IllegalArgumentException on validation failure
     * @throws RuntimeException         on I/O error
     */
    public String store(MultipartFile file) {
        validate(file);

        String original = cleanOriginalFilename(file.getOriginalFilename());
        String extension = getExtension(original);
        String stored = UUID.randomUUID() + (extension.isEmpty() ? "" : "." + extension);

        try {
            Path target = uploadDir.resolve(stored);
            Files.copy(file.getInputStream(), target, StandardCopyOption.REPLACE_EXISTING);
            log.info("Stored file {} as {}", original, stored);
            return stored;
        } catch (IOException ex) {
            throw new RuntimeException("Failed to store file " + original, ex);
        }
    }

    /**
     * Loads a stored file as a Spring {@link Resource}.
     */
    public Resource load(String storedFileName) {
        try {
            Path filePath = uploadDir.resolve(storedFileName).normalize();
            Resource resource = new UrlResource(filePath.toUri());
            if (resource.exists()) {
                return resource;
            }
            throw new RuntimeException("File not found: " + storedFileName);
        } catch (MalformedURLException ex) {
            throw new RuntimeException("File not found: " + storedFileName, ex);
        }
    }

    /**
     * Removes a stored file from disk if it still exists.
     */
    public void delete(String storedFileName) {
        try {
            Path filePath = uploadDir.resolve(storedFileName).normalize();
            Files.deleteIfExists(filePath);
        } catch (IOException ex) {
            throw new RuntimeException("Failed to delete file " + storedFileName, ex);
        }
    }

    /**
     * Determines the high-level {@link FileCategory} from a MIME type.
     */
    public FileCategory categorize(String contentType) {
        if (contentType == null)
            return FileCategory.OTHER;
        if (contentType.startsWith("image/"))
            return FileCategory.IMAGE;
        if (contentType.contains("zip")
                || contentType.contains("tar")
                || contentType.contains("gzip")
                || contentType.contains("7z")
                || contentType.contains("rar"))
            return FileCategory.ZIP;
        if (contentType.startsWith("application/")
                || contentType.startsWith("text/"))
            return FileCategory.DOCUMENT;
        return FileCategory.OTHER;
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private void validate(MultipartFile file) {
        if (file == null) {
            throw new IllegalArgumentException("Uploaded file is required.");
        }
        if (file.isEmpty()) {
            throw new IllegalArgumentException("Uploaded file is empty.");
        }
        if (file.getSize() > MAX_FILE_SIZE) {
            throw new IllegalArgumentException(
                    "File too large. Maximum allowed size is 20 MB.");
        }
        String ct = file.getContentType();
        if (ct == null || !ALLOWED_TYPES.contains(ct.toLowerCase(Locale.ROOT))) {
            throw new IllegalArgumentException(
                    "File type not allowed: " + ct +
                            ". Allowed: images, PDFs, Office docs, plain text, zip/tar/gz archives.");
        }
        String name = cleanOriginalFilename(file.getOriginalFilename());
        if (name.contains("..")) {
            throw new IllegalArgumentException(
                    "Invalid filename (path traversal detected): " + name);
        }
    }

    private static String cleanOriginalFilename(String originalFilename) {
        if (originalFilename == null || originalFilename.isBlank()) {
            throw new IllegalArgumentException("Original filename is required.");
        }

        return StringUtils.cleanPath(originalFilename);
    }

    private static String getExtension(String filename) {
        int dot = filename.lastIndexOf('.');
        return (dot >= 0) ? filename.substring(dot + 1).toLowerCase() : "";
    }
}
