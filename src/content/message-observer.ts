import { getSettings } from '@/lib/utils/settings';
import { translateMessage } from '@/lib/utils/translator';
import { isDiscordMessage, createDiscordMessage } from './message-utils';
import { RequestQueue, debounce } from '@/lib/utils/async-control';

// Configuration constants
const MAX_CONCURRENT_REQUESTS = 3; // Limit concurrent translation API requests
const DEBOUNCE_DELAY = 100; // Debounce delay in milliseconds for batch processing

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
            if (isDiscordMessage(element)) {
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
    const existingMessages = document.querySelectorAll('[class*="message"]');
    existingMessages.forEach((msg) => this.observeMessage(msg as HTMLElement));

    // Monitor new messages
    this.mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });

    console.log(`[MessageObserver] Observing ${existingMessages.length} existing messages`);
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

    // Process all pending messages through the request queue
    const messagesToProcess = Array.from(this.pendingMessages.entries());
    this.pendingMessages.clear();

    console.log(`[MessageObserver] Processing ${messagesToProcess.length} messages (queue: ${this.translationQueue.getQueueSize()}, running: ${this.translationQueue.getRunningCount()})`);

    for (const [messageId, element] of messagesToProcess) {
      // Skip if already translated
      if (this.translatedMessages.has(messageId)) {
        continue;
      }

      // Add to queue with rate limiting
      this.translationQueue.add(async () => {
        await this.handleVisibleMessage(element, messageId, settings);
      }).catch((error) => {
        console.error(`[MessageObserver] Translation failed for message ${messageId}:`, error);
      });
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
    const contentElement = element.querySelector('[class*="messageContent"]');
    if (!contentElement) return;

    if (mode === 'replace') {
      // Replace mode
      contentElement.textContent = translation;
    } else {
      // Append mode
      const translationEl = document.createElement('div');
      translationEl.className = 'discord-translator-translation';
      translationEl.style.cssText = 'margin-top: 4px; color: #888; font-size: 0.9em;';
      translationEl.textContent = `→ ${translation}`;
      contentElement.appendChild(translationEl);
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
