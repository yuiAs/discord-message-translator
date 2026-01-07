import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OpenAICompatibleClient } from './openai-compatible';

// Mock fetch
global.fetch = vi.fn();

describe('OpenAICompatibleClient', () => {
  let client: OpenAICompatibleClient;
  const apiKey = process.env.OPENAI_API_KEY || 'test-openai-key';
  const baseUrl = 'https://api.openai.com/v1';
  const model = 'gpt-4';

  beforeEach(() => {
    vi.clearAllMocks();
    client = new OpenAICompatibleClient({
      apiKey,
      baseUrl,
      model,
    });
  });

  describe('translate', () => {
    it('should translate text successfully', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: 'Bonjour',
            },
          },
        ],
      };

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await client.translate('Hello', 'fr');

      expect(result).toBe('Bonjour');
      expect(fetch).toHaveBeenCalledWith(
        `${baseUrl}/chat/completions`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('should include correct model in request', async () => {
      const mockResponse = {
        choices: [{ message: { content: 'こんにちは' } }],
      };

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      await client.translate('Hello', 'ja');

      const callArgs = vi.mocked(fetch).mock.calls[0];
      const body = JSON.parse(callArgs[1]?.body as string);
      expect(body.model).toBe(model);
    });

    it('should include system prompt with target language', async () => {
      const mockResponse = {
        choices: [{ message: { content: 'Hola' } }],
      };

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      await client.translate('Hello', 'es');

      const callArgs = vi.mocked(fetch).mock.calls[0];
      const body = JSON.parse(callArgs[1]?.body as string);

      expect(body.messages).toHaveLength(2);
      expect(body.messages[0].role).toBe('system');
      expect(body.messages[0].content).toContain('Spanish');
      expect(body.messages[1].role).toBe('user');
      expect(body.messages[1].content).toBe('Hello');
    });

    it('should use low temperature for consistent translations', async () => {
      const mockResponse = {
        choices: [{ message: { content: 'Guten Tag' } }],
      };

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      await client.translate('Hello', 'de');

      const callArgs = vi.mocked(fetch).mock.calls[0];
      const body = JSON.parse(callArgs[1]?.body as string);
      expect(body.temperature).toBe(0.3);
    });

    it('should throw error on API failure', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        statusText: 'Unauthorized',
        json: async () => ({
          error: {
            message: 'Invalid API key',
          },
        }),
      } as Response);

      await expect(client.translate('Hello', 'fr')).rejects.toThrow(
        'OpenAI API Error'
      );
    });

    it('should throw error when translation is empty', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: '',
            },
          },
        ],
      };

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      await expect(client.translate('Hello', 'fr')).rejects.toThrow(
        'OpenAI API returned empty translation'
      );
    });

    it('should trim whitespace from translated text', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: '  Bonjour  \n',
            },
          },
        ],
      };

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await client.translate('Hello', 'fr');
      expect(result).toBe('Bonjour');
    });

    it('should handle Chinese language variants', async () => {
      const mockResponse = {
        choices: [{ message: { content: '你好' } }],
      };

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      await client.translate('Hello', 'zh-CN');

      const callArgs = vi.mocked(fetch).mock.calls[0];
      const body = JSON.parse(callArgs[1]?.body as string);
      expect(body.messages[0].content).toContain('Simplified Chinese');
    });

    it('should work with custom base URL', async () => {
      const customClient = new OpenAICompatibleClient({
        apiKey: 'custom-key',
        baseUrl: 'https://custom-api.example.com/v1',
        model: 'claude-3-5-sonnet-20241022',
      });

      const mockResponse = {
        choices: [{ message: { content: 'Translated' } }],
      };

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      await customClient.translate('Test', 'ja');

      expect(fetch).toHaveBeenCalledWith(
        'https://custom-api.example.com/v1/chat/completions',
        expect.any(Object)
      );
    });
  });
});
