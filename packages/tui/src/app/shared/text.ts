export function truncateInlineMessage(message: string, maxWidth: number): string {
  const normalizedMessage = message.replace(/\s+/gu, " ").trim();
  if (maxWidth <= 0) {
    return "";
  }

  if (normalizedMessage.length <= maxWidth) {
    return normalizedMessage;
  }

  if (maxWidth <= 3) {
    return normalizedMessage.slice(0, maxWidth);
  }

  return `${normalizedMessage.slice(0, maxWidth - 3)}...`;
}
