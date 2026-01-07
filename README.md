# Discord Message Translator

Chrome Extension to automatically translate Discord messages with Google Translate, DeepL, or OpenAI-compatible APIs.

## Features

- **Auto Translation**: Automatically translate Discord messages as they appear
- **Multiple Translation Providers**: Support for Google Translate (DeepL and OpenAI-compatible APIs coming soon)
- **Smart Caching**: Message ID-based caching with automatic cleanup to reduce API costs
- **Intersection Observer**: Only translates visible messages for optimal performance
- **Translation Modes**: Replace original text or show both original and translation
- **Modern UI**: Built with DaisyUI and Tailwind CSS

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Build the Extension

```bash
npm run build
```

This will create a `dist` folder with the compiled extension.

### 3. Load the Extension in Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in the top right)
3. Click "Load unpacked"
4. Select the `dist` folder

### 4. Configure API Key

1. Click the extension icon in Chrome
2. Click "Settings"
3. Enter your Google Translate API key
   - Get an API key from [Google Cloud Translation API](https://cloud.google.com/translate/docs)
4. Click "Save Settings"

## Development

### Run in Development Mode

```bash
npm run dev
```

This will start Vite in development mode with hot reloading.

### Type Checking

```bash
npm run type-check
```

## Project Structure

```
discord-message-translator/
├── src/
│   ├── background/          # Service Worker
│   ├── content/             # Content Script (injected into Discord)
│   ├── popup/               # Popup UI
│   ├── options/             # Settings page
│   ├── lib/
│   │   ├── api/             # Translation API clients
│   │   ├── cache/           # Cache implementation
│   │   └── utils/           # Utility functions
│   └── types/               # TypeScript type definitions
├── public/
│   ├── manifest.json        # Chrome Extension manifest
│   └── icons/               # Extension icons
└── CLAUDE.md                # Implementation plan
```

## Usage

### Quick Start

1. Open Discord in Chrome
2. Click the extension icon
3. Toggle "Auto Translate" on
4. Select your target language
5. Messages will be automatically translated as you scroll

### Settings

- **Target Language**: Choose which language to translate to
- **Translation Mode**:
  - **Replace Original**: Replace the original message with translation
  - **Show Both**: Display both original and translated text
- **Cache TTL**: How long to keep translations cached (default: 7 days)
- **Clear Cache**: Manually clear all cached translations

## Technical Details

### Cache Management

- Uses Chrome Storage API (10MB limit)
- Automatic LRU (Least Recently Used) cleanup when reaching 80% capacity
- Reduces to 60% capacity by deleting oldest messages
- Ensures new messages can always be cached

### Performance Optimizations

- **Intersection Observer**: Only translates messages visible in viewport
- **Smart Caching**: Avoids duplicate API calls for the same message
- **100px Root Margin**: Pre-loads translations before scrolling to prevent flickering

### Future Enhancements (Phase 2 & 3)

- DeepL API integration
- OpenAI-compatible API with automatic language detection
- IndexedDB migration for unlimited cache storage
- Batch translation support
- Enhanced error handling and retry logic

## License

MIT
