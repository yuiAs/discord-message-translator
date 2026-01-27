import { getSettings } from '@/lib/utils/settings';
import { translateMessage, translateMessageBatch } from '@/lib/utils/translator';
import { isDiscordMessage, createDiscordMessage, findTranslatableElements } from './message-utils';
import { RequestQueue, debounce } from '@/lib/utils/async-control';

/**
 * Generate a unique key for tracking translated elements
 * Uses element's position in DOM to distinguish reply context from main content
 */
function getElementKey(element: HTMLElement): string {
  const messageId = element.id?.match(/^message-content-(\d+)$/)?.[1] || '';
  const isReplyContext = element.closest('[id^="message-reply-context-"]') !== null;
  return `${messageId}-${isReplyContext ? 'reply' : 'main'}`;
}

// Configuration constants
const MAX_CONCURRENT_REQUESTS = 3; // Limit concurrent translation API requests
const DEBOUNCE_DELAY = 100; // Debounce delay in milliseconds for batch processing
const BATCH_SIZE = 10; // Number of messages to translate in a single batch

export class MessageTranslationObserver {
  private intersectionObserver: IntersectionObserver;
  private mutationObserver: MutationObserver;
  private observedMessages = new Set<string>(); // Message IDs already being observed
  private translatedMessages = new Set<string>(); // Message IDs already translated (for main content)
  private translatedElements = new Set<string>(); // Element keys already translated (includes reply contexts)
  private translationQueue: RequestQueue; // Request queue for rate limiting
  private pendingMessages: Map<string, HTMLElement> = new Map(); // Messages waiting to be processed
  private processPendingDebounced: () => void;

  constructor() {
    // Initialize request queue with concurrency limit
    this.translationQueue = new RequestQueue(MAX_CONCURRENT_REQUESTS);

    // Debounced batch processor
    this.processPendingDebounced = debounce(() => {
      this.processPendingMessages();
    }, DEBOUNCE_DELAY);

    // Intersection Observer: Translate messages that enter the visible area
    this.intersectionObserver = new IntersectionObserver(
      (entries) => {
        // Collect all intersecting messages
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const messageElement = entry.target as HTMLElement;
            const message = createDiscordMessage(messageElement);
            if (message && !this.translatedMessages.has(message.id)) {
              this.pendingMessages.set(message.id, messageElement);
            }
          }
        });

        // Process messages in batches using debounce
        this.processPendingDebounced();
      },
      {
        root: null, // Use viewport as root
        rootMargin: '100px', // Start loading 100px before viewport (prevent flickering during scroll)
        threshold: 0.1, // Trigger when 10% visible
      }
    );

    // Mutation Observer: Detect new messages and register with Intersection Observer
    this.mutationObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as HTMLElement;

            // Check if the added element is a message container
            if (element.id?.startsWith('chat-messages-')) {
              this.observeMessage(element);
              return;
            }

            // Check if element contains message containers
            const messageContainers = element.querySelectorAll('[id^="chat-messages-"]');
            messageContainers.forEach((container) => {
              this.observeMessage(container as HTMLElement);
            });

            // Fallback: check with isDiscordMessage for legacy compatibility
            if (messageContainers.length === 0 && isDiscordMessage(element)) {
              this.observeMessage(element);
            }
          }
        });
      });
    });
  }

  start() {
    console.log('[MessageObserver] Starting...');

    // Add existing messages to observation list
    // Use multiple selectors for better compatibility
    const existingMessages = document.querySelectorAll(
      '[id^="chat-messages-"], [id^="message-content-"]'
    );
    const uniqueMessages = new Set<HTMLElement>();

    existingMessages.forEach((el) => {
      // If it's a message-content element, find its parent message container
      if (el.id?.startsWith('message-content-')) {
        const messageContainer = el.closest('[id^="chat-messages-"]') as HTMLElement;
        if (messageContainer) {
          uniqueMessages.add(messageContainer);
        } else {
          // No container found, observe the element itself
          uniqueMessages.add(el as HTMLElement);
        }
      } else {
        uniqueMessages.add(el as HTMLElement);
      }
    });

    uniqueMessages.forEach((msg) => this.observeMessage(msg));

    // Monitor new messages
    this.mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });

    console.log(`[MessageObserver] Observing ${uniqueMessages.size} existing messages`);
  }

  private observeMessage(element: HTMLElement) {
    const message = createDiscordMessage(element);
    if (message && !this.observedMessages.has(message.id)) {
      this.observedMessages.add(message.id);
      this.intersectionObserver.observe(element);
    }
  }

  /**
   * Process pending messages in batch with rate limiting
   * Uses batch translation API when multiple messages are pending
   */
  private async processPendingMessages() {
    if (this.pendingMessages.size === 0) {
      return;
    }

    const settings = await getSettings();
    if (!settings.autoTranslate) {
      this.pendingMessages.clear();
      return;
    }

    // Get all pending messages
    const messagesToProcess = Array.from(this.pendingMessages.entries());
    this.pendingMessages.clear();

    // Filter out already translated messages
    const filteredMessages = messagesToProcess.filter(
      ([messageId]) => !this.translatedMessages.has(messageId)
    );

    if (filteredMessages.length === 0) {
      return;
    }

    console.log(`[MessageObserver] Processing ${filteredMessages.length} messages (queue: ${this.translationQueue.getQueueSize()}, running: ${this.translationQueue.getRunningCount()})`);

    // Process messages in batches for efficiency
    if (filteredMessages.length >= BATCH_SIZE) {
      // Use batch translation for better performance
      this.translationQueue.add(async () => {
        await this.handleVisibleMessagesBatch(filteredMessages, settings);
      }).catch((error) => {
        console.error(`[MessageObserver] Batch translation failed:`, error);
      });
    } else {
      // For small numbers, use individual translation
      for (const [messageId, element] of filteredMessages) {
        this.translationQueue.add(async () => {
          await this.handleVisibleMessage(element, messageId, settings);
        }).catch((error) => {
          console.error(`[MessageObserver] Translation failed for message ${messageId}:`, error);
        });
      }
    }
  }

  /**
   * Handle batch translation for multiple visible messages
   * More efficient than translating individually
   * Translates all translatable elements including reply contexts
   */
  private async handleVisibleMessagesBatch(
    messagePairs: Array<[string, HTMLElement]>,
    settings: Awaited<ReturnType<typeof getSettings>>
  ) {
    // Collect all translatable elements from all message containers
    const elementsToTranslate: Array<{
      contentId: string;
      content: string;
      element: HTMLElement;
      elementKey: string;
      parentMessageId: string;
    }> = [];

    for (const [messageId, container] of messagePairs) {
      if (this.translatedMessages.has(messageId)) {
        continue;
      }

      const translatableElements = findTranslatableElements(container);

      for (const contentElement of translatableElements) {
        const elementKey = getElementKey(contentElement);

        if (this.translatedElements.has(elementKey)) {
          continue;
        }

        const contentId = contentElement.id?.match(/^message-content-(\d+)$/)?.[1];
        const text = contentElement.textContent?.trim() || '';

        if (!contentId || !text) {
          continue;
        }

        elementsToTranslate.push({
          contentId,
          content: text,
          element: contentElement,
          elementKey,
          parentMessageId: messageId,
        });
      }
    }

    if (elementsToTranslate.length === 0) {
      return;
    }

    try {
      // Batch translate all unique content (keyed by contentId to avoid duplicates)
      const uniqueContents = new Map<string, string>();
      for (const item of elementsToTranslate) {
        if (!uniqueContents.has(item.contentId)) {
          uniqueContents.set(item.contentId, item.content);
        }
      }

      const translations = await translateMessageBatch(
        Array.from(uniqueContents.entries()).map(([id, content]) => ({ id, content })),
        settings.targetLanguage
      );

      // Inject translations into all elements
      const translatedParentIds = new Set<string>();

      for (const { contentId, element, elementKey, parentMessageId } of elementsToTranslate) {
        const translation = translations.get(contentId);
        if (translation) {
          this.injectTranslationToElement(element, translation, settings.translationMode);
          this.translatedElements.add(elementKey);
          translatedParentIds.add(parentMessageId);
        }
      }

      // Mark parent messages as translated
      for (const parentId of translatedParentIds) {
        this.translatedMessages.add(parentId);
      }

      console.log(`[MessageObserver] Batch translated ${elementsToTranslate.length} elements from ${translatedParentIds.size} messages`);
    } catch (error) {
      console.error('[MessageObserver] Batch translation failed:', error);
      throw error;
    }
  }

  /**
   * Handle translation for a single visible message
   * Translates all translatable elements including reply context
   */
  private async handleVisibleMessage(
    element: HTMLElement,
    messageId: string,
    settings: Awaited<ReturnType<typeof getSettings>>
  ) {
    // Find all translatable elements (main content + reply context)
    const translatableElements = findTranslatableElements(element);

    if (translatableElements.length === 0) {
      return;
    }

    // Process each translatable element
    for (const contentElement of translatableElements) {
      const elementKey = getElementKey(contentElement);

      // Skip if this specific element is already translated
      if (this.translatedElements.has(elementKey)) {
        continue;
      }

      const contentId = contentElement.id?.match(/^message-content-(\d+)$/)?.[1];
      const text = contentElement.textContent?.trim() || '';

      if (!contentId || !text) {
        continue;
      }

      try {
        const translation = await translateMessage(
          contentId,
          text,
          settings.targetLanguage
        );

        // Inject translation into this specific element
        this.injectTranslationToElement(contentElement, translation, settings.translationMode);
        this.translatedElements.add(elementKey);
      } catch (error) {
        console.error(`[MessageObserver] Translation failed for element ${elementKey}:`, error);
        throw error;
      }
    }

    // Mark main message as translated
    this.translatedMessages.add(messageId);
  }

  /**
   * Inject translation directly into a specific content element
   * Handles complex message structures (headings, lists, mentions, etc.)
   */
  private injectTranslationToElement(
    contentElement: HTMLElement,
    translation: string,
    mode: 'replace' | 'append'
  ) {
    // Check if already translated (avoid duplicate injections)
    if (contentElement.querySelector('.discord-translator-translation')) {
      return;
    }

    // Check if parent has message-reply-context-* (reply preview context)
    const isReplyContext = contentElement.closest('[id^="message-reply-context-"]') !== null;

    // Create a wrapper for original content if it doesn't exist
    let originalWrapper = contentElement.querySelector('.discord-translator-original') as HTMLElement;
    if (!originalWrapper) {
      // Wrap all existing children in a span for easier manipulation
      originalWrapper = document.createElement('span');
      originalWrapper.className = 'discord-translator-original';
      // Move all children into the wrapper
      while (contentElement.firstChild) {
        originalWrapper.appendChild(contentElement.firstChild);
      }
      contentElement.appendChild(originalWrapper);
    }

    // Create translation element
    const translationSpan = document.createElement('span');
    translationSpan.className = 'discord-translator-translation';
    translationSpan.style.cssText = 'color: #b9bbbe; font-size: 0.95em;';
    translationSpan.textContent = translation;

    if (mode === 'replace') {
      // Replace mode - hide original content and show translation
      originalWrapper.style.display = 'none';
      contentElement.appendChild(translationSpan);
    } else {
      // Append mode - show both original and translation
      if (isReplyContext) {
        // Reply context: inline without line break (space separated)
        contentElement.append(document.createTextNode(' '), translationSpan);
      } else {
        // Normal message: add line break between original and translation
        const br = document.createElement('br');
        contentElement.append(br, translationSpan);
      }
    }
  }

  stop() {
    console.log('[MessageObserver] Stopping...');
    this.intersectionObserver.disconnect();
    this.mutationObserver.disconnect();
    this.observedMessages.clear();
    this.translatedMessages.clear();
    this.translatedElements.clear();
    this.pendingMessages.clear();
    this.translationQueue.clear();
  }
}
