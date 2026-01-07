import { defineConfig } from 'vitest/config';
import { resolve } from 'path';
import { loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  // Load environment variables from .env file
  const env = loadEnv(mode, process.cwd(), '');

  return {
    test: {
      globals: true,
      environment: 'happy-dom',
      setupFiles: ['./vitest.setup.ts'],
      env: {
        // Make API keys available in tests
        GOOGLE_CLOUD_TRANSLATION_API_KEY: env.GOOGLE_CLOUD_TRANSLATION_API_KEY || '',
        DEEPL_API_KEY: env.DEEPL_API_KEY || '',
        OPENAI_API_KEY: env.OPENAI_API_KEY || '',
      },
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json', 'html'],
        exclude: [
          'node_modules/',
          'dist/',
          '.tmp/',
          '**/*.test.ts',
          '**/*.spec.ts',
        ],
      },
    },
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
      },
    },
  };
});
