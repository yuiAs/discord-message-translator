import { DiscordMessage } from '@/types/message';

// Discord message content element selectors (in priority order)
const MESSAGE_CONTENT_SELECTORS = [
  '[id^="message-content-"]',           // Primary: message-content-{snowflake}
  '[id^="message-reply-context-"]',     // Reply context preview
  '[class*="messageContent"]',          // Fallback: class-based selector
];

/**
 * Check if element is a Discord message list item (contains translatable content)
 */
export function isDiscordMessage(element: HTMLElement): boolean {
  // Check if element is a message list item
  if (element.id?.startsWith('chat-messages-')) {
    return true;
  }

  // Check if element contains message content elements
  for (const selector of MESSAGE_CONTENT_SELECTORS) {
    if (element.querySelector(selector) !== null) {
      return true;
    }
  }

  // Legacy fallback
  return element.matches('[class*="message-"]');
}

/**
 * Find all translatable content elements within a message
 * Returns elements with id like "message-content-*" or "message-reply-context-*"
 */
export function findTranslatableElements(messageElement: HTMLElement): HTMLElement[] {
  const elements: HTMLElement[] = [];

  // Find message content elements
  const contentElements = messageElement.querySelectorAll('[id^="message-content-"]');
  contentElements.forEach((el) => elements.push(el as HTMLElement));

  // Find reply context elements (optional - can be disabled if not wanted)
  const replyElements = messageElement.querySelectorAll('[id^="message-reply-context-"]');
  replyElements.forEach((el) => {
    // Get the actual text content element within reply context
    const replyContent = el.querySelector('[id^="message-content-"]');
    if (replyContent) {
      elements.push(replyContent as HTMLElement);
    }
  });

  return elements;
}

/**
 * Extract Discord Snowflake ID from element id attribute
 * e.g., "message-content-1465389247128404098" -> "1465389247128404098"
 */
export function extractMessageId(element: HTMLElement): string | null {
  // 1. Try to extract from message-content-* or message-reply-context-* id
  if (element.id) {
    const match = element.id.match(/^message-(?:content|reply-context)-(\d+)$/);
    if (match) {
      return match[1]; // Return the Snowflake ID
    }
  }

  // 2. Try to find content element within and extract from it
  const contentElement = element.querySelector('[id^="message-content-"]');
  if (contentElement?.id) {
    const match = contentElement.id.match(/^message-content-(\d+)$/);
    if (match) {
      return match[1];
    }
  }

  // 3. Try chat-messages list item id (e.g., "chat-messages-{channelId}-{messageId}")
  if (element.id?.startsWith('chat-messages-')) {
    const parts = element.id.split('-');
    if (parts.length >= 4) {
      return parts[parts.length - 1]; // Last part is message ID
    }
  }

  // 4. Get from data-message-id attribute
  const dataId = element.getAttribute('data-message-id');
  if (dataId) return dataId;

  // 5. Fallback: content hash
  const text = extractMessageText(element);
  if (text) {
    return generateHash(text);
  }

  return null;
}

/**
 * Extract message text from element
 */
export function extractMessageText(element: HTMLElement): string {
  // If element itself is a message-content element
  if (element.id?.startsWith('message-content-')) {
    return element.textContent?.trim() || '';
  }

  // Find message content element by id (preferred)
  const contentById = element.querySelector('[id^="message-content-"]');
  if (contentById) {
    return contentById.textContent?.trim() || '';
  }

  // Fallback: class-based selector
  const contentByClass = element.querySelector('[class*="messageContent"]');
  if (contentByClass) {
    return contentByClass.textContent?.trim() || '';
  }

  // Last resort: entire element text
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
