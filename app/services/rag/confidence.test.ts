import { describe, it, expect } from 'vitest';
import { deriveConfidence } from './confidence.js';
import type { RetrievedChunk } from './types.js';

function makeChunk(score: number): RetrievedChunk {
  return { content: 'test', sourcePath: 'test.md', hash: 'abc', score, bm25Score: score, vectorScore: score };
}

describe('deriveConfidence', () => {
  it('returns out_of_scope when chunks array is empty', () => {
    expect(deriveConfidence([])).toBe('out_of_scope');
  });

  it('returns grounded when top score is exactly 0.7', () => {
    expect(deriveConfidence([makeChunk(0.7)])).toBe('grounded');
  });

  it('returns grounded when top score is above 0.7', () => {
    expect(deriveConfidence([makeChunk(0.95)])).toBe('grounded');
  });

  it('returns weak when top score is exactly 0.4', () => {
    expect(deriveConfidence([makeChunk(0.4)])).toBe('weak');
  });

  it('returns weak when top score is between 0.4 and 0.7', () => {
    expect(deriveConfidence([makeChunk(0.55)])).toBe('weak');
  });

  it('returns out_of_scope when top score is below 0.4', () => {
    expect(deriveConfidence([makeChunk(0.39)])).toBe('out_of_scope');
  });

  it('uses only the first chunk score when multiple chunks are present', () => {
    expect(deriveConfidence([makeChunk(0.8), makeChunk(0.1)])).toBe('grounded');
    expect(deriveConfidence([makeChunk(0.1), makeChunk(0.9)])).toBe('out_of_scope');
  });
});
