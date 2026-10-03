/**
 * WhatsApp Chat Log Parser
 * Supports both iOS ([DD/MM/YYYY, HH:MM:SS] Name: text)
 * and Android (DD/MM/YYYY, HH:MM - Name: text) formats.
 */

export function parseWhatsAppChat(rawText) {
  if (!rawText || typeof rawText !== 'string') return [];

  const lines = rawText.split(/\r?\n/);
  const messages = [];
  let currentMsg = null;

  // Regex patterns for different WhatsApp date/time headers
  // 1. iOS: [12/03/2026, 10:14:22 AM] Sender: Message
  const iosRegex = /^\[(\d{1,2}[\/\.-]\d{1,2}[\/\.-]\d{2,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AaPp][Mm])?)\]\s+([^:]+):\s+(.*)$/;
  
  // 2. Android: 12/03/2026, 10:14 - Sender: Message or 12/03/2026, 10:14 AM - Sender: Message
  const androidRegex = /^(\d{1,2}[\/\.-]\d{1,2}[\/\.-]\d{2,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AaPp][Mm])?)\s+-\s+([^:]+):\s+(.*)$/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    let match = line.match(iosRegex) || line.match(androidRegex);

    if (match) {
      if (currentMsg) {
        messages.push(currentMsg);
      }

      const dateStr = match[1];
      const timeStr = match[2];
      const sender = match[3].trim();
      const content = match[4].trim();

      // Skip common WhatsApp system notifications
      if (
        sender.includes('end-to-end encrypted') ||
        content.includes('Messages and calls are end-to-end encrypted') ||
        content.includes('created group') ||
        content.includes('changed the subject')
      ) {
        currentMsg = null;
        continue;
      }

      currentMsg = {
        id: `msg_${Date.now()}_${i}`,
        index: messages.length + 1,
        date: dateStr,
        time: timeStr,
        dateTimeStr: `${dateStr}, ${timeStr}`,
        sender: sender,
        text: content,
        raw: line
      };
    } else {
      // Continuation of previous multiline message
      if (currentMsg) {
        currentMsg.text += '\n' + line;
        currentMsg.raw += '\n' + line;
      }
    }
  }

  if (currentMsg) {
    messages.push(currentMsg);
  }

  return messages;
}
