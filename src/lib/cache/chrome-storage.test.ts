import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ChromeStorageCache } from './chrome-storage';
import { TranslationCacheEntry } from '@/types/cache';

describe('ChromeStorageCache', () => {
  let cache: ChromeStorageCache;

  beforeEach(() => {
    vi.clearAllMocks();
    cache = new ChromeStorageCache();
  });

  describe('get', () => {
    it('should return cached entry if exists and not expired', async () => {
      const messageId = 'test-message-1';
      const entry: TranslationCacheEntry = {
        translations: { en: 'Hello' },
        timestamp: Date.now(),
      };

      vi.mocked(chrome.storage.local.get).mockResolvedValue({
        [`cache_${messageId}`]: entry,
      });

      vi.mocked(chrome.storage.sync.get).mockResolvedValue({ cacheTTLDays: 7 });

      const result = await cache.get(messageId);

      expect(result).toEqual(entry);
      expect(chrome.storage.local.get).toHaveBeenCalledWith([`cache_${messageId}`]);
    });

    it('should return null if entry does not exist', async () => {
      const messageId = 'non-existent';

      vi.mocked(chrome.storage.local.get).mockResolvedValue({});

      const result = await cache.get(messageId);

      expect(result).toBeNull();
    });

    it('should delete and return null if entry is expired', async () => {
      const messageId = 'test-message-expired';
      const expiredEntry: TranslationCacheEntry = {
        translations: { en: 'Old translation' },
        timestamp: Date.now() - 10 * 24 * 60 * 60 * 1000, // 10 days ago
      };

      vi.mocked(chrome.storage.local.get).mockResolvedValue({
        [`cache_${messageId}`]: expiredEntry,
      });

      vi.mocked(chrome.storage.sync.get).mockResolvedValue({ cacheTTLDays: 7 });
      vi.mocked(chrome.storage.local.remove).mockResolvedValue(undefined);

      const result = await cache.get(messageId);

      expect(result).toBeNull();
      expect(chrome.storage.local.remove).toHaveBeenCalledWith([`cache_${messageId}`]);
    });
  });

  describe('set', () => {
    it('should save entry to storage', async () => {
      const messageId = 'test-message-2';
      const entry: TranslationCacheEntry = {
        translations: { ja: 'こんにちは' },
        timestamp: Date.now(),
      };

      vi.mocked(chrome.storage.local.getBytesInUse).mockResolvedValue(1000);
      vi.mocked(chrome.storage.local.set).mockResolvedValue(undefined);

      await cache.set(messageId, entry);

      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        [`cache_${messageId}`]: entry,
      });
    });
  });

  describe('delete', () => {
    it('should remove entry from storage', async () => {
      const messageId = 'test-message-3';

      vi.mocked(chrome.storage.local.remove).mockResolvedValue(undefined);

      await cache.delete(messageId);

      expect(chrome.storage.local.remove).toHaveBeenCalledWith([`cache_${messageId}`]);
    });
  });

  describe('clear', () => {
    it('should remove all cache entries', async () => {
      const allData = {
        cache_message1: { translations: {}, timestamp: Date.now() },
        cache_message2: { translations: {}, timestamp: Date.now() },
        otherKey: 'value',
      };

      vi.mocked(chrome.storage.local.get).mockResolvedValue(allData);
      vi.mocked(chrome.storage.local.remove).mockResolvedValue(undefined);

      await cache.clear();

      expect(chrome.storage.local.remove).toHaveBeenCalledWith([
        'cache_message1',
        'cache_message2',
      ]);
    });
  });

  describe('getAllEntries', () => {
    it('should return all cache entries as a Map', async () => {
      const entry1: TranslationCacheEntry = {
        translations: { en: 'Hello' },
        timestamp: Date.now(),
      };
      const entry2: TranslationCacheEntry = {
        translations: { ja: 'こんにちは' },
        timestamp: Date.now(),
      };

      vi.mocked(chrome.storage.local.get).mockResolvedValue({
        cache_message1: entry1,
        cache_message2: entry2,
        otherKey: 'value',
      });

      const result = await cache.getAllEntries();

      expect(result.size).toBe(2);
      expect(result.get('message1')).toEqual(entry1);
      expect(result.get('message2')).toEqual(entry2);
    });
  });

  describe('cleanupExpired', () => {
    it('should remove expired entries', async () => {
      const now = Date.now();
      const validEntry: TranslationCacheEntry = {
        translations: { en: 'Valid' },
        timestamp: now,
      };
      const expiredEntry: TranslationCacheEntry = {
        translations: { en: 'Expired' },
        timestamp: now - 10 * 24 * 60 * 60 * 1000, // 10 days ago
      };

      vi.mocked(chrome.storage.local.get).mockResolvedValue({
        cache_valid: validEntry,
        cache_expired: expiredEntry,
      });

      vi.mocked(chrome.storage.sync.get).mockResolvedValue({ cacheTTLDays: 7 });
      vi.mocked(chrome.storage.local.remove).mockResolvedValue(undefined);

      await cache.cleanupExpired();

      expect(chrome.storage.local.remove).toHaveBeenCalledWith(['cache_expired']);
    });
  });
});
