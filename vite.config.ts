import { defineConfig } from 'vite';
import { resolve } from 'path';

// Check if we're building content scripts (standalone IIFE builds)
const isContentBuild = process.env.BUILD_TARGET === 'content';
const isBackgroundBuild = process.env.BUILD_TARGET === 'background';

export default defineConfig(() => {
  // Content script build - single IIFE file
  if (isContentBuild) {
    return {
      resolve: {
        alias: {
          '@': resolve(__dirname, 'src'),
        },
      },
      build: {
        outDir: 'dist',
        emptyOutDir: false,
        lib: {
          entry: resolve(__dirname, 'src/content/index.ts'),
          name: 'content',
          formats: ['iife'],
          fileName: () => 'content.js',
        },
        rollupOptions: {
          output: {
            extend: true,
          },
        },
      },
    };
  }

  // Background script build - single IIFE file
  if (isBackgroundBuild) {
    return {
      resolve: {
        alias: {
          '@': resolve(__dirname, 'src'),
        },
      },
      build: {
        outDir: 'dist',
        emptyOutDir: false,
        lib: {
          entry: resolve(__dirname, 'src/background/index.ts'),
          name: 'background',
          formats: ['iife'],
          fileName: () => 'background.js',
        },
        rollupOptions: {
          output: {
            extend: true,
          },
        },
      },
    };
  }

  // Default build - popup and options pages (ES modules OK for extension pages)
  return {
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
      },
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      rollupOptions: {
        input: {
          popup: resolve(__dirname, 'src/popup/index.html'),
          options: resolve(__dirname, 'src/options/index.html'),
        },
        output: {
          entryFileNames: 'assets/[name]-[hash].js',
          chunkFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash].[ext]',
        },
      },
    },
  };
});
