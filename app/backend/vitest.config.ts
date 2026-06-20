import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'url';

export default defineConfig({
  test: {
    globals: false,
    include: [
      '**/*.{test,spec}.{ts,tsx}',
      '../services/**/*.{test,spec}.ts',
    ],
  },
  resolve: {
    alias: {
      '@shared': fileURLToPath(new URL('../../packages/shared/src', import.meta.url)),
      '@rag': fileURLToPath(new URL('../services/rag', import.meta.url)),
      '@llm': fileURLToPath(new URL('../services/llm', import.meta.url)),
    },
  },
});
