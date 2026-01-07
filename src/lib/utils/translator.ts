import { createStorage } from '@/lib/cache/factory';
import { TranslationCacheEntry } from '@/types/cache';
import { getSettings } from './settings';
import { GoogleTranslateClient } from '@/lib/api/google-translate';
import { DeepLClient } from '@/lib/api/deepl';
import { OpenAICompatibleClient } from '@/lib/api/openai-compatible';

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
