import { TranslationCacheEntry } from '@/types/cache';

export interface ITranslationStorage {
  get(messageId: string): Promise<TranslationCacheEntry | null>;
  set(messageId: string, entry: TranslationCacheEntry): Promise<void>;
  delete(messageId: string): Promise<void>;
  clear(): Promise<void>;
  cleanupExpired(): Promise<void>;
  getAllEntries(): Promise<Map<string, TranslationCacheEntry>>;
}
