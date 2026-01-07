import { DiscordMessage } from '@/types/message';

/**
 * Check if element is a Discord message
 */
export function isDiscordMessage(element: HTMLElement): boolean {
  // Check Discord message element
  // Check with multiple conditions as class names may change
  return (
    element.matches('[class*="message-"]') ||
    element.querySelector('[class*="messageContent"]') !== null ||
    element.id?.startsWith('chat-messages-') ||
    false
  );
}

/**
 * Extract message ID
 */
export function extractMessageId(element: HTMLElement): string | null {
  // 1. Get from data-message-id attribute
  const dataId = element.getAttribute('data-message-id');
  if (dataId) return dataId;

  // 2. Get from id attribute
  if (element.id) return element.id;

  // 3. Fallback: content hash
  const text = extractMessageText(element);
  if (text) {
    return generateHash(text);
  }

  return null;
}

/**
 * Extract message text
 */
export function extractMessageText(element: HTMLElement): string {
  // Find Discord message content element
  const contentElement = element.querySelector('[class*="messageContent"]');
  if (contentElement) {
    return contentElement.textContent?.trim() || '';
  }

  // Fallback: entire element text
  return element.textContent?.trim() || '';
}

/**
 * Simple hash function (for fallback)
 */
function generateHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return `hash_${Math.abs(hash)}`;
}

/**
 * Create Discord message object
 */
export function createDiscordMessage(element: HTMLElement): DiscordMessage | null {
  const id = extractMessageId(element);
  const content = extractMessageText(element);

  if (!id || !content) return null;

  return {
    id,
    content,
    element,
  };
}
