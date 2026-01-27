import { getSettings } from '@/lib/utils/settings';
import { translateMessage, translateMessageBatch } from '@/lib/utils/translator';
import { isDiscordMessage, createDiscordMessage, findTranslatableElements, extractMessageId, extractMessageText } from './message-utils';
import { RequestQueue, debounce } from '@/lib/utils/async-control';

// Configuration constants
const MAX_CONCURRENT_REQUESTS = 3; // Limit concurrent translation API requests
const DEBOUNCE_DELAY = 100; // Debounce delay in milliseconds for batch processing
const BATCH_SIZE = 10; // Number of messages to translate in a single batch

export class MessageTranslationObserver {
  private intersectionObserver: IntersectionObserver;
  private mutationObserver: MutationObserver;
  private observedMessages = new Set<string>(); // Message IDs already being observed
  private translatedMessages = new Set<string>(); // Message IDs already translated
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
   */
  private async handleVisibleMessagesBatch(
    messagePairs: Array<[string, HTMLElement]>,
    settings: Awaited<ReturnType<typeof getSettings>>
  ) {
    const batchMessages = messagePairs
      .map(([messageId, element]) => {
        const message = createDiscordMessage(element);
        if (!message || this.translatedMessages.has(message.id)) {
          return null;
        }
        return { id: message.id, content: message.content, element };
      })
      .filter((m): m is NonNullable<typeof m> => m !== null);

    if (batchMessages.length === 0) {
      return;
    }

    try {
      const translations = await translateMessageBatch(
        batchMessages.map(m => ({ id: m.id, content: m.content })),
        settings.targetLanguage
      );

      // Inject all translations into DOM
      for (const { id, element } of batchMessages) {
        const translation = translations.get(id);
        if (translation) {
          this.injectTranslation(element, translation, settings.translationMode);
          this.translatedMessages.add(id);
        }
      }

      console.log(`[MessageObserver] Batch translated ${batchMessages.length} messages`);
    } catch (error) {
      console.error('[MessageObserver] Batch translation failed:', error);
      throw error;
    }
  }

  /**
   * Handle translation for a single visible message
   */
  private async handleVisibleMessage(
    element: HTMLElement,
    messageId: string,
    settings: Awaited<ReturnType<typeof getSettings>>
  ) {
    const message = createDiscordMessage(element);
    if (!message || this.translatedMessages.has(message.id)) {
      return; // Already translated
    }

    try {
      const translation = await translateMessage(
        message.id,
        message.content,
        settings.targetLanguage
      );

      // Inject translation into DOM
      this.injectTranslation(element, translation, settings.translationMode);
      this.translatedMessages.add(message.id);
    } catch (error) {
      console.error(`[MessageObserver] Translation failed for message ${message.id}:`, error);
      throw error; // Re-throw to be caught by queue handler
    }
  }

  private injectTranslation(
    element: HTMLElement,
    translation: string,
    mode: 'replace' | 'append'
  ) {
    // Find message content element by ID first (more reliable)
    let contentElement: HTMLElement | null = element.querySelector('[id^="message-content-"]');

    // Fallback to class-based selector
    if (!contentElement) {
      contentElement = element.querySelector('[class*="messageContent"]');
    }

    // If element itself is a message-content element
    if (!contentElement && element.id?.startsWith('message-content-')) {
      contentElement = element;
    }

    if (!contentElement) {
      console.warn('[MessageObserver] Could not find content element for translation injection');
      return;
    }

    // Check if already translated (avoid duplicate injections)
    if (contentElement.querySelector('.discord-translator-translation')) {
      return;
    }

    // Find the first span containing the message text
    const originalSpan = contentElement.querySelector('span');
    const originalText = originalSpan?.textContent || contentElement.textContent || '';

    if (mode === 'replace') {
      // Replace mode - store original text as data attribute for potential restoration
      if (!contentElement.hasAttribute('data-original-text')) {
        contentElement.setAttribute('data-original-text', originalText);
      }
      if (originalSpan) {
        originalSpan.textContent = translation;
      } else {
        contentElement.textContent = translation;
      }
    } else {
      // Both mode - show original and translation
      // Check if parent has message-reply-context-* (reply preview context)
      const isReplyContext = contentElement.closest('[id^="message-reply-context-"]') !== null;

      const translationSpan = document.createElement('span');
      translationSpan.className = 'discord-translator-translation';
      translationSpan.style.cssText = 'color: #b9bbbe; font-size: 0.95em;';
      translationSpan.textContent = translation;

      if (isReplyContext) {
        // Reply context: inline without line break (space separated)
        // <span>original</span> <span>translation</span>
        if (originalSpan) {
          originalSpan.after(document.createTextNode(' '), translationSpan);
        } else {
          contentElement.append(document.createTextNode(' '), translationSpan);
        }
      } else {
        // Normal message: add line break between original and translation
        // <span>original</span><br /><span>translation</span>
        const br = document.createElement('br');
        if (originalSpan) {
          originalSpan.after(br, translationSpan);
        } else {
          contentElement.append(br, translationSpan);
        }
      }
    }
  }

  stop() {
    console.log('[MessageObserver] Stopping...');
    this.intersectionObserver.disconnect();
    this.mutationObserver.disconnect();
    this.observedMessages.clear();
    this.translatedMessages.clear();
    this.pendingMessages.clear();
    this.translationQueue.clear();
  }
}
