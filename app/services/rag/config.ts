import type { KBConfig } from './types.js';

export const KB_CONFIG: KBConfig = {
  repo: 'docker/docs',
  includeGlobs: [
    'manuals/engine/**',
    'manuals/build/**',
    'manuals/compose/**',
    'manuals/desktop/**',
    'manuals/security/**',
    'reference/**',
    'get-started/**',
  ],
  minChunkChars: 160,
  embeddingDimensions: 1536,
};
