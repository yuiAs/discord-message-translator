import { getSettings } from '@/lib/utils/settings';
import { translateMessage } from '@/lib/utils/translator';
import { isDiscordMessage, createDiscordMessage } from './message-utils';

export class MessageTranslationObserver {
  private intersectionObserver: IntersectionObserver;
  private mutationObserver: MutationObserver;
  private observedMessages = new Set<string>(); // Message IDs already being observed
  private translatedMessages = new Set<string>(); // Message IDs already translated

  constructor() {
    // Intersection Observer: Translate messages that enter the visible area
    this.intersectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach(async (entry) => {
          if (entry.isIntersecting) {
            const messageElement = entry.target as HTMLElement;
            await this.handleVisibleMessage(messageElement);
          }
        });
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

  private async handleVisibleMessage(element: HTMLElement) {
    const message = createDiscordMessage(element);
    if (!message || this.translatedMessages.has(message.id)) {
      return; // Already translated
    }

    const settings = await getSettings();
    if (!settings.autoTranslate) {
      return; // Auto-translate is off
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
  }
}
