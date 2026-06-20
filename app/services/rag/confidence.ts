import type { RetrievedChunk, ConfidenceLevel } from './types.js';

const GROUNDED_THRESHOLD = 0.7;
const WEAK_THRESHOLD = 0.4;

export function deriveConfidence(chunks: RetrievedChunk[]): ConfidenceLevel {
  if (chunks.length === 0) return 'out_of_scope';
  const topScore = chunks[0].score;
  if (topScore >= GROUNDED_THRESHOLD) return 'grounded';
  if (topScore >= WEAK_THRESHOLD) return 'weak';
  return 'out_of_scope';
}
