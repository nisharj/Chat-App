import { useEffect, useState } from "react";
import { FaEnvelope } from "react-icons/fa";
import {
  HiArchiveBox,
  HiArrowDownTray,
  HiBars3,
  HiDocumentText,
  HiPaperClip,
  HiPhoto,
  HiUserGroup,
  HiXMark,
} from "react-icons/hi2";
import api, { getApiErrorMessage } from "../../../services/api";
import { formatFileSize } from "../../../utils/chatMessages";

const FILE_INPUT_ACCEPT =
  "image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.tar,.gz,.7z,.rar";

function ProtectedImagePreview({ attachment, onMissing }) {
  const [imageSrc, setImageSrc] = useState("");

  useEffect(() => {
    let cancelled = false;
    let objectUrl = "";

    const loadImage = async () => {
      try {
        const response = await api.get(attachment?.downloadUrl, {
          responseType: "blob",
        });

        if (cancelled) return;

        objectUrl = URL.createObjectURL(response.data);
        setImageSrc(objectUrl);
      } catch {
        if (!cancelled) {
          onMissing?.();
        }
      }
    };

    loadImage();

    return () => {
      cancelled = true;

      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [attachment?.downloadUrl, onMissing]);

  if (!imageSrc) {
    return (
      <div className="flex h-48 items-center justify-center rounded-xl border border-black/5 bg-white text-sm text-slate-500">
        Loading image...
      </div>
    );
  }

  return (
    <img
      src={imageSrc}
      alt={attachment?.originalFileName ?? "Uploaded image"}
      className="max-h-80 w-full object-cover"
      loading="lazy"
    />
  );
}

export default function ChatPanel({
  user,
  activeRoom,
  messages,
  messagesEndRef,
  typingLabel,
  input,
  onInputChange,
  onSend,
  selectedFile,
  fileCaption,
  uploadError,
  isUploading,
  onFileSelect,
  onFileCaptionChange,
  onRemoveFile,
  onUploadFile,
  selectedMessages = [],
  showDeleteModal = false,
  setShowDeleteModal = () => {},
  toggleMessageSelection = () => {},
  clearSelection = () => {},
  deleteSelectedMessages = () => {},
  canDeleteSelectedForEveryone = false,
  chatError = "",
  onOpenSidebar,
}) {
  const [missingFiles, setMissingFiles] = useState({});
  const [localError, setLocalError] = useState("");

  const formatTime = (sentAt) => {
    if (!sentAt) return "";

    const date = new Date(sentAt);
    const isToday = date.toDateString() === new Date().toDateString();

    const time = date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    return isToday
      ? time
      : `${date.toLocaleDateString([], {
          month: "short",
          day: "numeric",
        })} ${time}`;
  };

  const getRoomDisplayName = (room) => {
    if (room.group) return room.name;

    if (room.name?.startsWith("dm_")) {
      const dmPart = room.name.replace("dm_", "");

      return dmPart.startsWith(`${user?.username}_`)
        ? dmPart.replace(`${user?.username}_`, "")
        : dmPart.replace(`_${user?.username}`, "");
    }

    return room.name;
  };

  const getAttachmentPresentation = (attachment) => {
    switch (attachment?.fileCategory) {
      case "IMAGE":
        return {
          icon: HiPhoto,
          label: "Image",
        };
      case "DOCUMENT":
        return {
          icon: HiDocumentText,
          label: "Document",
        };
      case "ZIP":
        return {
          icon: HiArchiveBox,
          label: "Archive",
        };
      default:
        return {
          icon: HiPaperClip,
          label: "File",
        };
    }
  };

  const markFileAsMissing = (messageKey) => {
    setMissingFiles((prev) => ({
      ...prev,
      [messageKey]: true,
    }));
  };

  const openProtectedFile = async (attachment, messageKey) => {
    try {
      const response = await api.get(attachment?.downloadUrl, {
        responseType: "blob",
      });

      const objectUrl = URL.createObjectURL(response.data);
      const fileName = attachment?.originalFileName ?? "download";
      const isInlineFriendly =
        attachment?.fileCategory === "IMAGE" ||
        attachment?.contentType === "application/pdf";

      if (isInlineFriendly) {
        const openedWindow = window.open(
          objectUrl,
          "_blank",
          "noopener,noreferrer",
        );

        if (!openedWindow) {
          const fallbackLink = document.createElement("a");
          fallbackLink.href = objectUrl;
          fallbackLink.download = fileName;
          document.body.appendChild(fallbackLink);
          fallbackLink.click();
          fallbackLink.remove();
        }
      } else {
        const downloadLink = document.createElement("a");
        downloadLink.href = objectUrl;
        downloadLink.download = fileName;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        downloadLink.remove();
      }

      window.setTimeout(() => {
        URL.revokeObjectURL(objectUrl);
      }, 60000);
    } catch (error) {
      console.error("Failed to open protected file:", error);
      markFileAsMissing(messageKey);
      setLocalError(getApiErrorMessage(error, "Could not open this file."));
    }
  };

  const renderFileMessage = (message, isOwn) => {
    const attachment = message.attachment;
    const { icon: AttachmentIcon, label } =
      getAttachmentPresentation(attachment);
    const isImage = attachment?.fileCategory === "IMAGE";
    const metaTextClass = "text-slate-500";
    const hasError = Boolean(missingFiles[message.clientKey]);

    if (isImage) {
      if (hasError) {
        return (
          <div className="space-y-1">
            <div className="flex h-10 items-center justify-center rounded-xl border border-red-200 bg-red-50 text-sm font-medium text-red-600">
              Image not available
            </div>

            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-slate-900">
                  {attachment?.originalFileName}
                </div>
                <div className={`mt-1 text-xs ${metaTextClass}`}>
                  {label} | {formatFileSize(attachment?.fileSize)}
                </div>
                {attachment?.caption && (
                  <p className="mt-2 break-words text-sm leading-relaxed text-slate-700">
                    {attachment.caption}
                  </p>
                )}
              </div>

              <span className={`shrink-0 text-xs ${metaTextClass}`}>
                {formatTime(message.sentAt)}
              </span>
            </div>
          </div>
        );
      }

      return (
        <div className="space-y-3">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              openProtectedFile(attachment, message.clientKey);
            }}
            className="block w-full overflow-hidden rounded-xl border border-black/5 bg-white text-left"
          >
            <ProtectedImagePreview
              attachment={attachment}
              onMissing={() => markFileAsMissing(message.clientKey)}
            />
          </button>

          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-slate-900">
                {attachment?.originalFileName}
              </div>
              <div className={`mt-1 text-xs ${metaTextClass}`}>
                {label} | {formatFileSize(attachment?.fileSize)}
              </div>
              {attachment?.caption && (
                <p className="mt-2 break-words text-sm leading-relaxed text-slate-700">
                  {attachment.caption}
                </p>
              )}
            </div>

            <span className={`shrink-0 text-xs ${metaTextClass}`}>
              {formatTime(message.sentAt)}
            </span>
          </div>
        </div>
      );
    }

    if (hasError) {
      return (
        <div className="space-y-3">
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
            File not available
          </div>

          <div className={`text-right text-xs ${metaTextClass}`}>
            {formatTime(message.sentAt)}
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <div
            className={`mt-1 rounded-lg p-2 ${
              isOwn
                ? "bg-blue-100 text-blue-700"
                : "bg-slate-100 text-slate-700"
            }`}
          >
            <AttachmentIcon className="text-lg" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-slate-900">
              {attachment?.originalFileName}
            </div>
            <div className={`mt-1 text-xs ${metaTextClass}`}>
              {label} | {formatFileSize(attachment?.fileSize)}
            </div>
            {attachment?.caption && (
              <p className="mt-2 break-words text-sm leading-relaxed text-slate-700">
                {attachment.caption}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              openProtectedFile(attachment, message.clientKey);
            }}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <HiArrowDownTray className="text-sm" />
            Open
          </button>
        </div>

        <div className={`text-right text-xs ${metaTextClass}`}>
          {formatTime(message.sentAt)}
        </div>
      </div>
    );
  };

  const renderTextMessage = (message) => (
    <div className="flex items-end gap-2">
      <p className="flex-1 break-words text-sm leading-relaxed">
        {message.content}
      </p>

      <span className="self-end whitespace-nowrap text-xs text-gray-100">
        {formatTime(message.sentAt)}
      </span>
    </div>
  );

  const handleFileInputChange = (event) => {
    const file = event.target.files?.[0];

    if (file) {
      onFileSelect(file);
    }

    event.target.value = "";
  };

  if (!activeRoom) {
    return (
      <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-white">
        <div className="flex items-center gap-3 border-b border-gray-200 px-4 py-4 sm:px-6">
          <button
            type="button"
            onClick={onOpenSidebar}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-gray-50 text-slate-700 hover:bg-gray-100 lg:hidden"
            aria-label="Open sidebar"
          >
            <HiBars3 className="text-xl" />
          </button>

          <div className="min-w-0 flex-1">
            <div className="text-base font-bold text-slate-900">ChatApp</div>
            <div className="text-sm text-slate-500">
              Select a room to start chatting
            </div>
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center px-6 text-center text-lg font-medium text-gray-400">
          Select a room to start chatting
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-white">
      <div className="flex items-center gap-3 border-b border-gray-200 px-4 py-4 sm:px-6">
        <button
          type="button"
          onClick={onOpenSidebar}
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-gray-50 text-slate-700 hover:bg-gray-100 lg:hidden"
          aria-label="Open sidebar"
        >
          <HiBars3 className="text-xl" />
        </button>

        <div className="min-w-0 flex-1 truncate text-base font-bold">
          {activeRoom.group ? (
            <>
              <HiUserGroup className="mr-2 inline" />
              {getRoomDisplayName(activeRoom)}
            </>
          ) : (
            <>
              <FaEnvelope className="mr-2 inline" />
              {getRoomDisplayName(activeRoom)}
            </>
          )}
        </div>
      </div>

      {(chatError || localError) && (
        <div className="border-b border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700 sm:px-6">
          {chatError || localError}
        </div>
      )}

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto bg-gray-50 p-4 sm:p-6">
        {selectedMessages.length > 0 && (
          <div className="flex items-center justify-between border-b border-red-200 bg-red-50 px-4 py-3 sm:px-6">
            <span className="text-sm font-medium text-red-700">
              {selectedMessages.length} selected
            </span>

            <div className="flex gap-2">
              <button
                onClick={() => setShowDeleteModal(true)}
                className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700"
              >
                Delete
              </button>

              <button
                onClick={clearSelection}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {(messages || []).map((message) => {
          const isOwn = message.senderUsername === user?.username;
          const messageId = String(message?.id ?? "");
          const isSelected = selectedMessages.includes(messageId);
          const isTextMessage = message.kind === "text";
          const isSelectable = Boolean(messageId);

          return (
            <div
              key={message.clientKey}
              className={`max-w-[88%] sm:max-w-[75%] ${
                isOwn ? "self-end" : "self-start"
              }`}
            >
              <div
                onContextMenu={(event) => {
                  if (!isSelectable) return;

                  event.preventDefault();
                  toggleMessageSelection(message);
                }}
                onClick={() => {
                  if (isSelectable && selectedMessages.length > 0) {
                    toggleMessageSelection(message);
                  }
                }}
                className={`rounded-2xl px-4 py-3 shadow-sm ${
                  isSelectable ? "cursor-pointer" : ""
                } ${isSelected ? "ring-2 ring-red-500" : ""} ${
                  isTextMessage
                    ? isOwn
                      ? "bg-blue-600 text-white"
                      : "bg-[#1f1f1f] text-white"
                    : isOwn
                      ? "border border-blue-100 bg-blue-50 text-slate-900"
                      : "border border-gray-200 bg-white text-slate-900"
                }`}
              >
                {!isOwn && activeRoom.group && (
                  <div
                    className={`mb-2 text-sm font-semibold ${
                      isTextMessage ? "text-orange-400" : "text-blue-600"
                    }`}
                  >
                    {message.senderUsername}
                  </div>
                )}

                {isTextMessage
                  ? renderTextMessage(message)
                  : renderFileMessage(message, isOwn)}
              </div>
            </div>
          );
        })}

        <div ref={messagesEndRef} />
      </div>

      {typingLabel && (
        <div className="px-4 py-2 text-sm text-gray-500 sm:px-6">
          {typingLabel}
        </div>
      )}

      {selectedFile && (
        <div className="border-t border-gray-200 bg-white px-4 pt-4 sm:px-6">
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <HiPaperClip className="text-base text-slate-500" />
                  <span className="truncate">{selectedFile.name}</span>
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {formatFileSize(selectedFile.size)}
                  {selectedFile.type ? ` | ${selectedFile.type}` : ""}
                </div>
              </div>

              <button
                type="button"
                onClick={onRemoveFile}
                disabled={isUploading}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-medium text-slate-500 hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <HiXMark className="text-base" />
                Remove
              </button>
            </div>

            <input
              type="text"
              placeholder="Add a caption (optional)"
              value={fileCaption}
              onChange={(event) => onFileCaptionChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  onUploadFile();
                }
              }}
              className="mt-4 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            {uploadError && (
              <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {uploadError}
              </div>
            )}

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={onUploadFile}
                disabled={isUploading}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <HiArrowDownTray className="text-base" />
                {isUploading ? "Uploading..." : "Upload file"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3 border-t border-gray-200 bg-white px-4 py-4 sm:flex-row sm:px-6">
        <label className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-gray-300 bg-gray-50 px-4 py-3 text-slate-600 hover:bg-gray-100">
          <input
            type="file"
            accept={FILE_INPUT_ACCEPT}
            className="hidden"
            onChange={handleFileInputChange}
            disabled={isUploading}
          />
          <HiPaperClip className="text-lg" />
        </label>

        <input
          type="text"
          placeholder={`Message ${getRoomDisplayName(activeRoom)}`}
          value={input}
          onChange={(event) => onInputChange(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && onSend()}
          className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-gray-50 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        <button
          onClick={onSend}
          className="w-full rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700 sm:w-auto"
        >
          Send
        </button>
      </div>

      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900">
              Delete Messages
            </h3>

            <p className="mt-2 text-sm text-slate-600">
              Choose how you want to delete the selected messages.
            </p>

            <div className="mt-6 space-y-3">
              <button
                onClick={() => deleteSelectedMessages("FOR_ME")}
                className="w-full rounded-lg bg-slate-900 px-4 py-3 text-white"
              >
                Delete for Me
              </button>

              <button
                onClick={() => deleteSelectedMessages("FOR_EVERYONE")}
                disabled={!canDeleteSelectedForEveryone}
                className="w-full rounded-lg bg-red-600 px-4 py-3 text-white disabled:cursor-not-allowed disabled:bg-red-300"
              >
                Delete for Everyone
              </button>

              <button
                onClick={clearSelection}
                className="w-full rounded-lg border px-4 py-3"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
