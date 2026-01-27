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
  // 1. Try to extract from message-content-* id (if element itself is a content element)
  if (element.id?.startsWith('message-content-')) {
    const match = element.id.match(/^message-content-(\d+)$/);
    if (match) {
      return match[1];
    }
  }

  // 2. Try chat-messages list item id (e.g., "chat-messages-{channelId}-{messageId}")
  if (element.id?.startsWith('chat-messages-')) {
    const parts = element.id.split('-');
    if (parts.length >= 4) {
      return parts[parts.length - 1]; // Last part is message ID
    }
  }

  // 3. Find the main message content (NOT reply preview) and extract from it
  const mainContent = findMainMessageContent(element);
  if (mainContent?.id) {
    const match = mainContent.id.match(/^message-content-(\d+)$/);
    if (match) {
      return match[1];
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
 * Find the main message content element (NOT inside reply context)
 */
export function findMainMessageContent(container: HTMLElement): HTMLElement | null {
  // If element itself is a message-content element, check if it's inside reply context
  if (container.id?.startsWith('message-content-')) {
    if (!container.closest('[id^="message-reply-context-"]')) {
      return container;
    }
    return null;
  }

  // Find all message-content elements and return the one NOT inside reply context
  const allContentElements = container.querySelectorAll('[id^="message-content-"]');
  for (const el of allContentElements) {
    if (!el.closest('[id^="message-reply-context-"]')) {
      return el as HTMLElement;
    }
  }

  // Fallback: class-based selector (also exclude reply context)
  const allByClass = container.querySelectorAll('[class*="messageContent"]');
  for (const el of allByClass) {
    if (!el.closest('[id^="message-reply-context-"]')) {
      return el as HTMLElement;
    }
  }

  return null;
}

/**
 * Extract visible text from element, excluding hidden elements like hiddenVisually
 */
function extractVisibleText(element: HTMLElement): string {
  // Clone the element to avoid modifying the original
  const clone = element.cloneNode(true) as HTMLElement;

  // Remove hidden elements (used for screen readers, e.g., commas between list items)
  const hiddenElements = clone.querySelectorAll('[class*="hiddenVisually"]');
  hiddenElements.forEach((el) => el.remove());

  return clone.textContent?.trim() || '';
}

/**
 * Extract message text from element
 */
export function extractMessageText(element: HTMLElement): string {
  // If element itself is a message-content element
  if (element.id?.startsWith('message-content-')) {
    return extractVisibleText(element);
  }

  // Find the main message content (not reply preview)
  const mainContent = findMainMessageContent(element);
  if (mainContent) {
    return extractVisibleText(mainContent);
  }

  // Last resort: entire element text
  return extractVisibleText(element);
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
