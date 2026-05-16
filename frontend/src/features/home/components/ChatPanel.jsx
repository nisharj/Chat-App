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
import { formatFileSize, resolveFileUrl } from "../../../utils/chatMessages";

const FILE_INPUT_ACCEPT =
  "image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.tar,.gz,.7z,.rar";

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
  onOpenSidebar,
}) {
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

  const renderFileMessage = (message, isOwn) => {
    const attachment = message.attachment;
    const fileUrl = resolveFileUrl(attachment?.downloadUrl);
    const { icon: AttachmentIcon, label } = getAttachmentPresentation(attachment);
    const isImage = attachment?.fileCategory === "IMAGE";
    const metaTextClass = isOwn ? "text-slate-500" : "text-slate-500";

    if (isImage) {
      return (
        <div className="space-y-3">
          <a
            href={fileUrl}
            target="_blank"
            rel="noreferrer"
            className="block overflow-hidden rounded-xl border border-black/5 bg-white"
          >
            <img
              src={fileUrl}
              alt={attachment?.originalFileName ?? "Uploaded image"}
              className="max-h-80 w-full object-cover"
              loading="lazy"
            />
          </a>

          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-slate-900">
                {attachment?.originalFileName}
              </div>
              <div className={`mt-1 text-xs ${metaTextClass}`}>
                {label} | {formatFileSize(attachment?.fileSize)}
              </div>
              {attachment?.caption && (
                <p className="mt-2 text-sm leading-relaxed text-slate-700 break-words">
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
        <div className="flex items-start gap-3">
          <div
            className={`mt-1 rounded-lg p-2 ${
              isOwn ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-700"
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
              <p className="mt-2 text-sm leading-relaxed text-slate-700 break-words">
                {attachment.caption}
              </p>
            )}
          </div>

          <a
            href={fileUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <HiArrowDownTray className="text-sm" />
            Open
          </a>
        </div>

        <div className={`text-right text-xs ${metaTextClass}`}>
          {formatTime(message.sentAt)}
        </div>
      </div>
    );
  };

  const renderTextMessage = (message) => (
    <div className="flex items-end gap-2">
      <p className="text-sm leading-relaxed break-words flex-1">
        {message.content}
      </p>

      <span className="text-xs text-gray-100 whitespace-nowrap self-end">
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
            <div className="text-sm text-slate-500">Select a room to start chatting</div>
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

        <div className="min-w-0 flex-1 truncate font-bold text-base">
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

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto bg-gray-50 p-4 sm:p-6">
        {(messages || []).map((message) => {
          const isOwn = message.senderUsername === user?.username;
          const isTextMessage = message.kind === "text";

          return (
            <div
              key={message.clientKey}
              className={`max-w-[88%] sm:max-w-[75%] ${isOwn ? "self-end" : "self-start"}`}
            >
              <div
                className={`rounded-2xl px-4 py-3 shadow-sm ${
                  isTextMessage
                    ? isOwn
                      ? "bg-blue-600 text-white"
                      : "bg-[#1f1f1f] text-white"
                    : isOwn
                      ? "bg-blue-50 text-slate-900 border border-blue-100"
                      : "bg-white text-slate-900 border border-gray-200"
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
        <div className="px-4 py-2 text-sm text-gray-500 sm:px-6">{typingLabel}</div>
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
    </div>
  );
}
