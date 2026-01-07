import { MessageTranslationObserver } from './message-observer';

let observer: MessageTranslationObserver | null = null;

// Start monitoring when extension launches
function initializeObserver() {
  if (observer) {
    observer.stop();
  }

  observer = new MessageTranslationObserver();
  observer.start();
}

// Initialize after page load complete
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeObserver);
} else {
  initializeObserver();
}

// Handle settings changes
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes.autoTranslate) {
    if (changes.autoTranslate.newValue) {
      initializeObserver();
    } else {
      observer?.stop();
    }
  }
});

console.log('[Discord Translator] Content script loaded');
