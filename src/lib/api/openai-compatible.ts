interface OpenAIConfig {
  baseUrl: string;
  model: string;
  apiKey: string;
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
}

interface ChatCompletionResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

export class OpenAICompatibleClient {
  private config: OpenAIConfig;

  constructor(config: OpenAIConfig) {
    this.config = config;
  }

  /**
   * Translate text using OpenAI-compatible API with automatic language detection
   * The LLM will automatically detect the source language
   */
  async translate(text: string, targetLang: string, _sourceLang?: string): Promise<string> {
    // Note: sourceLang is ignored as LLM can auto-detect the language
    const targetLanguageName = this.getLanguageName(targetLang);

    const systemPrompt = `You are a professional translator. Your task is to translate the given text to ${targetLanguageName}.
Rules:
- Automatically detect the source language
- Provide ONLY the translated text without any explanations or additional content
- Preserve the original formatting and tone
- Do not add quotation marks or any other characters around the translation`;

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: systemPrompt,
      },
      {
        role: 'user',
        content: text,
      },
    ];

    const requestBody: ChatCompletionRequest = {
      model: this.config.model,
      messages,
      temperature: 0.3, // Lower temperature for more consistent translations
      max_tokens: 1000,
    };

    const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
      throw new Error(`OpenAI API Error: ${error.error?.message || response.statusText}`);
    }

    const data: ChatCompletionResponse = await response.json();
    const translatedText = data.choices[0]?.message?.content?.trim();

    if (!translatedText) {
      throw new Error('OpenAI API returned empty translation');
    }

    return translatedText;
  }

  /**
   * Translate multiple texts in a single API request
   * More efficient for batch processing
   */
  async translateBatch(texts: string[], targetLang: string, _sourceLang?: string): Promise<string[]> {
    if (texts.length === 0) {
      return [];
    }

    const targetLanguageName = this.getLanguageName(targetLang);

    // Create numbered list of texts to translate
    const numberedTexts = texts.map((text, i) => `${i + 1}. ${text}`).join('\n');

    const systemPrompt = `You are a professional translator. Your task is to translate multiple texts to ${targetLanguageName}.
Rules:
- Automatically detect the source language for each text
- Provide translations in JSON array format: ["translation1", "translation2", ...]
- Preserve the original formatting and tone
- Return ONLY the JSON array, no explanations or additional content`;

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: systemPrompt,
      },
      {
        role: 'user',
        content: `Translate these texts:\n${numberedTexts}`,
      },
    ];

    const requestBody: ChatCompletionRequest = {
      model: this.config.model,
      messages,
      temperature: 0.3,
      max_tokens: 2000,
    };

    const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
      throw new Error(`OpenAI API Error: ${error.error?.message || response.statusText}`);
    }

    const data: ChatCompletionResponse = await response.json();
    const content = data.choices[0]?.message?.content?.trim();

    if (!content) {
      throw new Error('OpenAI API returned empty translation');
    }

    try {
      // Parse JSON response
      const translations = JSON.parse(content);
      if (!Array.isArray(translations) || translations.length !== texts.length) {
        throw new Error('Invalid translation array length');
      }
      return translations;
    } catch (error) {
      console.error('[OpenAI] Failed to parse batch translation:', content);
      throw new Error(`Failed to parse batch translation response: ${error}`);
    }
  }

  /**
   * Convert language code to full language name for better LLM understanding
   */
  private getLanguageName(langCode: string): string {
    const languageMap: Record<string, string> = {
      'en': 'English',
      'ja': 'Japanese',
      'ko': 'Korean',
      'zh': 'Chinese',
      'zh-cn': 'Simplified Chinese',
      'zh-tw': 'Traditional Chinese',
      'es': 'Spanish',
      'fr': 'French',
      'de': 'German',
      'pt': 'Portuguese',
      'ru': 'Russian',
      'it': 'Italian',
      'nl': 'Dutch',
      'pl': 'Polish',
      'ar': 'Arabic',
      'hi': 'Hindi',
      'th': 'Thai',
      'vi': 'Vietnamese',
      'id': 'Indonesian',
      'tr': 'Turkish',
      'sv': 'Swedish',
      'da': 'Danish',
      'fi': 'Finnish',
      'no': 'Norwegian',
    };

    return languageMap[langCode.toLowerCase()] || langCode.toUpperCase();
  }
}
