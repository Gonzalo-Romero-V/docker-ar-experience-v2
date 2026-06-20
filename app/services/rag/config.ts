import type { KBConfig } from './types.js';

export const KB_CONFIG: KBConfig = {
  repo: 'docker/docs',
  includeGlobs: [
    'engine/**',
    'build/**',
    'compose/**',
    'storage/**',
    'network/**',
    'reference/**',
    'get-started/**',
  ],
  minChunkChars: 160,
  embeddingDimensions: 1536,
};
