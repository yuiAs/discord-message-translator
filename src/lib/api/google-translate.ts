export class GoogleTranslateClient {
  private apiKey: string;
  private baseUrl = 'https://translation.googleapis.com/language/translate/v2';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async translate(text: string, targetLang: string, sourceLang?: string): Promise<string> {
    const params = new URLSearchParams({
      q: text,
      target: targetLang,
      key: this.apiKey,
      format: 'text',
    });

    if (sourceLang) {
      params.append('source', sourceLang);
    }

    const response = await fetch(`${this.baseUrl}?${params.toString()}`, {
      method: 'POST',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Google Translate API Error: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return data.data.translations[0].translatedText;
  }
}
