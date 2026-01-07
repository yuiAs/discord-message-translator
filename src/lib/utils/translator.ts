import { createStorage } from '@/lib/cache/factory';
import { TranslationCacheEntry } from '@/types/cache';
import { getSettings } from './settings';
import { GoogleTranslateClient } from '@/lib/api/google-translate';

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

  // Call API
  let translation: string;

  if (settings.translationProvider === 'google' && settings.apiKeys.google) {
    const client = new GoogleTranslateClient(settings.apiKeys.google);
    translation = await client.translate(text, targetLang);
  } else {
    throw new Error('Translation provider not configured or API key missing');
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
