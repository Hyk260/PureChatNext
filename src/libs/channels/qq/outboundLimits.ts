/** QQ 附件大小上限（入站解析 / 网页代发共用）。 */
export const QQ_MAX_FILE_BYTES = 10 * 1024 * 1024

export const QQ_MAX_OUTBOUND_FILE_BYTES = QQ_MAX_FILE_BYTES
export const QQ_MAX_OUTBOUND_FILES = 5

export function qqOutboundFileLimitLabel(bytes = QQ_MAX_OUTBOUND_FILE_BYTES) {
  return `${Math.round(bytes / (1024 * 1024))}MB`
}
