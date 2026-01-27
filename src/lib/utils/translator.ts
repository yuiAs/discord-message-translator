import { createStorage } from '@/lib/cache/factory';
import { TranslationCacheEntry } from '@/types/cache';
import { getSettings } from './settings';
import { GoogleTranslateClient } from '@/lib/api/google-translate';
import { DeepLClient } from '@/lib/api/deepl';
import { OpenAICompatibleClient } from '@/lib/api/openai-compatible';
import { ChromeBuiltinTranslator } from '@/lib/api/chrome-builtin';

// Singleton instance for Chrome Built-in Translator (to reuse translator cache)
let chromeBuiltinInstance: ChromeBuiltinTranslator | null = null;

function getChromeBuiltinTranslator(): ChromeBuiltinTranslator {
  if (!chromeBuiltinInstance) {
    chromeBuiltinInstance = new ChromeBuiltinTranslator();
  }
  return chromeBuiltinInstance;
}

export async function translateMessage(
  messageId: string,
  text: string,
  targetLang: string
): Promise<string> {
  const storage = await createStorage();

  // Check cache
  const cached = await storage.get(messageId);
  if (cached?.translations[targetLang]) {
    console.log(`[Translator] Cache hit for message ${messageId}`);
    return cached.translations[targetLang];
  }

  // Get settings
  const settings = await getSettings();

  // Call API based on selected provider
  let translation: string;

  switch (settings.translationProvider) {
    case 'google':
      if (!settings.apiKeys.google) {
        throw new Error('Google Translate API key is not configured');
      }
      const googleClient = new GoogleTranslateClient(settings.apiKeys.google);
      translation = await googleClient.translate(text, targetLang);
      break;

    case 'deepl':
      if (!settings.apiKeys.deepl) {
        throw new Error('DeepL API key is not configured');
      }
      // Assume free account by default. Could be made configurable in settings.
      const deeplClient = new DeepLClient(settings.apiKeys.deepl, true);
      translation = await deeplClient.translate(text, targetLang);
      break;

    case 'openai':
      if (!settings.apiKeys.openai || !settings.openaiConfig) {
        throw new Error('OpenAI API is not configured');
      }
      const openaiClient = new OpenAICompatibleClient({
        apiKey: settings.apiKeys.openai,
        baseUrl: settings.openaiConfig.baseUrl,
        model: settings.openaiConfig.model,
      });
      translation = await openaiClient.translate(text, targetLang);
      break;

    case 'chrome-builtin':
      if (!ChromeBuiltinTranslator.isAvailable()) {
        throw new Error('Chrome Built-in Translator API is not available. Please use Chrome 138+ or select a different provider.');
      }
      const chromeBuiltinClient = getChromeBuiltinTranslator();
      translation = await chromeBuiltinClient.translate(text, targetLang);
      break;

    default:
      throw new Error(`Unsupported translation provider: ${settings.translationProvider}`);
  }

  // Save to cache
  const entry: TranslationCacheEntry = {
    translations: {
      ...(cached?.translations || {}),
      [targetLang]: translation,
    },
    timestamp: Date.now(),
  };
  await storage.set(messageId, entry);

  console.log(`[Translator] Translated and cached message ${messageId}`);
  return translation;
}

/**
 * Translate multiple messages in a single batch request
 * More efficient than translating individually
 */
export async function translateMessageBatch(
  messages: Array<{ id: string; content: string }>,
  targetLang: string
): Promise<Map<string, string>> {
  const storage = await createStorage();
  const settings = await getSettings();
  const results = new Map<string, string>();

  // Separate cached and uncached messages
  const uncachedMessages: typeof messages = [];
  const uncachedTexts: string[] = [];

  for (const message of messages) {
    const cached = await storage.get(message.id);
    if (cached?.translations[targetLang]) {
      results.set(message.id, cached.translations[targetLang]);
      console.log(`[Translator] Cache hit for message ${message.id}`);
    } else {
      uncachedMessages.push(message);
      uncachedTexts.push(message.content);
    }
  }

  // If all messages are cached, return immediately
  if (uncachedMessages.length === 0) {
    return results;
  }

  // Call batch translation API
  let translations: string[];

  try {
    switch (settings.translationProvider) {
      case 'google':
        if (!settings.apiKeys.google) {
          throw new Error('Google Translate API key is not configured');
        }
        const googleClient = new GoogleTranslateClient(settings.apiKeys.google);
        translations = await googleClient.translateBatch(uncachedTexts, targetLang);
        break;

      case 'deepl':
        if (!settings.apiKeys.deepl) {
          throw new Error('DeepL API key is not configured');
        }
        const deeplClient = new DeepLClient(settings.apiKeys.deepl, true);
        translations = await deeplClient.translateBatch(uncachedTexts, targetLang);
        break;

      case 'openai':
        if (!settings.apiKeys.openai || !settings.openaiConfig) {
          throw new Error('OpenAI API is not configured');
        }
        const openaiClient = new OpenAICompatibleClient({
          apiKey: settings.apiKeys.openai,
          baseUrl: settings.openaiConfig.baseUrl,
          model: settings.openaiConfig.model,
        });
        translations = await openaiClient.translateBatch(uncachedTexts, targetLang);
        break;

      case 'chrome-builtin':
        if (!ChromeBuiltinTranslator.isAvailable()) {
          throw new Error('Chrome Built-in Translator API is not available. Please use Chrome 138+ or select a different provider.');
        }
        const chromeBuiltinClient = getChromeBuiltinTranslator();
        translations = await chromeBuiltinClient.translateBatch(uncachedTexts, targetLang);
        break;

      default:
        throw new Error(`Unsupported translation provider: ${settings.translationProvider}`);
    }
  } catch (error) {
    console.error('[Translator] Batch translation failed:', error);
    throw error;
  }

  // Save translations to cache and results
  for (let i = 0; i < uncachedMessages.length; i++) {
    const message = uncachedMessages[i];
    const translation = translations[i];

    results.set(message.id, translation);

    // Update cache
    const cached = await storage.get(message.id);
    const entry: TranslationCacheEntry = {
      translations: {
        ...(cached?.translations || {}),
        [targetLang]: translation,
      },
      timestamp: Date.now(),
    };
    await storage.set(message.id, entry);
  }

  console.log(`[Translator] Batch translated and cached ${uncachedMessages.length} messages`);
  return results;
}
