import api from "../services/api";

const ABSOLUTE_URL_PATTERN = /^https?:\/\//i;

const toTimestamp = (value) => {
  if (!value) return 0;

  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
};

const compareMessages = (left, right) => {
  const timeDifference = toTimestamp(left?.sentAt) - toTimestamp(right?.sentAt);

  if (timeDifference !== 0) {
    return timeDifference;
  }

  return String(left?.clientKey ?? "").localeCompare(String(right?.clientKey ?? ""));
};

const buildTextFallbackKey = ({ roomId, senderUsername, sentAt, content }) =>
  `text:${roomId ?? "unknown"}:${senderUsername ?? "unknown"}:${sentAt ?? "unknown"}:${content ?? ""}`;

const buildFileFallbackKey = ({ roomId, senderUsername, sentAt, downloadUrl }) =>
  `file:${roomId ?? "unknown"}:${senderUsername ?? "unknown"}:${sentAt ?? "unknown"}:${downloadUrl ?? ""}`;

export const normalizeTextHistoryMessage = (message) => {
  const roomId = message?.room?.id ? String(message.room.id) : String(message?.roomId ?? "");
  const senderUsername = message?.sender?.username ?? message?.senderUsername ?? "Unknown";
  const sentAt = message?.sentAt ?? null;
  const content = message?.content ?? "";

  return {
    clientKey: message?.id
      ? `text:${message.id}`
      : buildTextFallbackKey({ roomId, senderUsername, sentAt, content }),
    kind: "text",
    roomId,
    senderUsername,
    sentAt,
    content,
    attachment: null,
  };
};

export const normalizeTextSocketMessage = (message) => {
  const roomId = String(message?.roomId ?? "");
  const senderUsername = message?.senderUsername ?? "Unknown";
  const sentAt = message?.sentAt ?? null;
  const content = message?.content ?? "";

  return {
    clientKey: buildTextFallbackKey({ roomId, senderUsername, sentAt, content }),
    kind: "text",
    roomId,
    senderUsername,
    sentAt,
    content,
    attachment: null,
  };
};

export const normalizeFileMessage = (message) => {
  const roomId = String(message?.chatRoomId ?? message?.roomId ?? "");
  const senderUsername = message?.sender ?? message?.senderUsername ?? "Unknown";
  const sentAt = message?.sentAt ?? null;
  const caption = message?.caption ?? "";
  const downloadUrl = message?.downloadUrl ?? "";

  return {
    clientKey: message?.id
      ? `file:${message.id}`
      : buildFileFallbackKey({ roomId, senderUsername, sentAt, downloadUrl }),
    kind: "file",
    roomId,
    senderUsername,
    sentAt,
    content: caption,
    attachment: {
      id: message?.id ?? null,
      originalFileName: message?.originalFileName ?? "Attachment",
      downloadUrl,
      contentType: message?.contentType ?? "",
      fileSize: Number(message?.fileSize ?? 0),
      fileCategory: message?.fileCategory ?? "OTHER",
      caption,
    },
  };
};

export const sortAndDeduplicateMessages = (messages) => {
  const byClientKey = new Map();

  (messages ?? []).forEach((message, index) => {
    if (!message) return;

    const clientKey = message.clientKey ?? `message:${index}`;

    if (!byClientKey.has(clientKey)) {
      byClientKey.set(clientKey, {
        ...message,
        clientKey,
      });
    }
  });

  return [...byClientKey.values()].sort(compareMessages);
};

export const mergeTimelineMessages = (...messageGroups) =>
  sortAndDeduplicateMessages(messageGroups.flat());

export const resolveFileUrl = (downloadUrl) => {
  if (!downloadUrl) return "";
  if (ABSOLUTE_URL_PATTERN.test(downloadUrl)) return downloadUrl;

  const baseUrl = String(api.defaults.baseURL ?? "").replace(/\/$/, "");
  const normalizedPath = downloadUrl.startsWith("/") ? downloadUrl : `/${downloadUrl}`;

  return `${baseUrl}${normalizedPath}`;
};

export const formatFileSize = (bytes) => {
  const size = Number(bytes ?? 0);

  if (!Number.isFinite(size) || size <= 0) {
    return "0 B";
  }

  if (size < 1024) {
    return `${size} B`;
  }

  const units = ["KB", "MB", "GB"];
  let value = size / 1024;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`;
};
