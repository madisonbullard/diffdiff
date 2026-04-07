export function formatMergeMessageBuffer(title: string, body: string): string {
  return body === "" ? title : `${title}\n\n${body}`;
}

export function parseMergeMessageBuffer(buffer: string): { body: string; title: string } {
  const normalized = buffer.replace(/\r\n/gu, "\n");
  const [title = "", ...remainingLines] = normalized.split("\n");
  let body = remainingLines.join("\n");
  if (body.startsWith("\n")) {
    body = body.slice(1);
  }

  return { body, title };
}
