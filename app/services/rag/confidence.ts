import type { RetrievedChunk, ConfidenceLevel } from './types.js';

// RRF (Reciprocal Rank Fusion) scores with K=60 top out at 1/61 ≈ 0.016.
// A combined best-of-both hit reaches ~0.033. Thresholds are calibrated to that scale.
const GROUNDED_THRESHOLD = 0.02; // appears well-ranked in at least one retrieval
const WEAK_THRESHOLD = 0.01;    // appears in at least one retrieval

export function deriveConfidence(chunks: RetrievedChunk[]): ConfidenceLevel {
  if (chunks.length === 0) return 'out_of_scope';
  const topScore = chunks[0].score;
  if (topScore >= GROUNDED_THRESHOLD) return 'grounded';
  if (topScore >= WEAK_THRESHOLD) return 'weak';
  return 'out_of_scope';
}
