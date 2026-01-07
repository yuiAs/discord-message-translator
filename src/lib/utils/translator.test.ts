import { describe, it, expect, beforeEach, vi } from 'vitest';
import { translateMessage } from './translator';

// Mock dependencies
vi.mock('@/lib/cache/factory', () => ({
  createStorage: vi.fn(() => ({
    get: vi.fn(),
    set: vi.fn(),
  })),
}));

vi.mock('./settings', () => ({
  getSettings: vi.fn(),
}));

vi.mock('@/lib/api/google-translate', () => ({
  GoogleTranslateClient: vi.fn().mockImplementation(() => ({
    translate: vi.fn(),
  })),
}));

import { createStorage } from '@/lib/cache/factory';
import { getSettings } from './settings';
import { GoogleTranslateClient } from '@/lib/api/google-translate';

describe('Translator Utilities', () => {
  let mockStorage: any;
  let mockTranslate: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockStorage = {
      get: vi.fn(),
      set: vi.fn(),
    };

    mockTranslate = vi.fn();

    vi.mocked(createStorage).mockResolvedValue(mockStorage);
    vi.mocked(GoogleTranslateClient).mockImplementation(() => ({
      translate: mockTranslate,
    }) as any);
  });

  describe('translateMessage', () => {
    it('should return cached translation if available', async () => {
      const messageId = 'msg-123';
      const cachedEntry = {
        translations: {
          ja: 'こんにちは',
        },
        timestamp: Date.now(),
      };

      mockStorage.get.mockResolvedValue(cachedEntry);
      vi.mocked(getSettings).mockResolvedValue({
        translationProvider: 'google',
        apiKeys: { google: 'test-key' },
      } as any);

      const result = await translateMessage(messageId, 'Hello', 'ja');

      expect(result).toBe('こんにちは');
      expect(mockTranslate).not.toHaveBeenCalled();
    });

    it('should call API and cache result when no cache exists', async () => {
      const messageId = 'msg-456';
      const translation = 'Bonjour';

      mockStorage.get.mockResolvedValue(null);
      mockTranslate.mockResolvedValue(translation);
      vi.mocked(getSettings).mockResolvedValue({
        translationProvider: 'google',
        apiKeys: { google: 'test-key' },
      } as any);

      const result = await translateMessage(messageId, 'Hello', 'fr');

      expect(result).toBe(translation);
      expect(mockTranslate).toHaveBeenCalledWith('Hello', 'fr');
      expect(mockStorage.set).toHaveBeenCalledWith(
        messageId,
        expect.objectContaining({
          translations: {
            fr: translation,
          },
        })
      );
    });

    it('should throw error if translation provider is not configured', async () => {
      mockStorage.get.mockResolvedValue(null);
      vi.mocked(getSettings).mockResolvedValue({
        translationProvider: 'google',
        apiKeys: {},
      } as any);

      await expect(translateMessage('msg-789', 'Hello', 'ja')).rejects.toThrow(
        'Translation provider not configured or API key missing'
      );
    });

    it('should merge new translation with existing cache', async () => {
      const messageId = 'msg-999';
      const existingCache = {
        translations: {
          ja: 'こんにちは',
        },
        timestamp: Date.now() - 1000,
      };

      mockStorage.get.mockResolvedValue(existingCache);
      mockTranslate.mockResolvedValue('Hola');
      vi.mocked(getSettings).mockResolvedValue({
        translationProvider: 'google',
        apiKeys: { google: 'test-key' },
      } as any);

      await translateMessage(messageId, 'Hello', 'es');

      expect(mockStorage.set).toHaveBeenCalledWith(
        messageId,
        expect.objectContaining({
          translations: {
            ja: 'こんにちは',
            es: 'Hola',
          },
        })
      );
    });
  });
});
