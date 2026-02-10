import { defineConfig } from 'wxt';
import { resolve } from 'node:path';

export default defineConfig({
  srcDir: '.',
  entrypointsDir: 'entrypoints',
  manifest: {
    name: 'Discord Message Translator',
    version: '1.1.0',
    description:
      'Automatically translate Discord messages with Google Translate, DeepL, or OpenAI-compatible APIs',
    permissions: ['storage', 'alarms'],
    host_permissions: [
      'https://discord.com/*',
      'https://*.discord.com/*',
    ],
    icons: {
      16: '/icons/icon16.png',
      48: '/icons/icon48.png',
      128: '/icons/icon128.png',
    },
  },
  alias: {
    '@': resolve(__dirname),
  },
});
