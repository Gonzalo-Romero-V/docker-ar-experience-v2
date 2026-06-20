import type { Pool } from 'pg';
import type OpenAI from 'openai';
import { generateEmbedding } from './embed.js';
import type { RetrievedChunk } from './types.js';

const DEFAULT_TOP_K = 10;
const RRF_K = 60;

export async function hybridSearch(
  deps: { pool: Pool; openai: OpenAI },
  query: string,
  topK = DEFAULT_TOP_K
): Promise<RetrievedChunk[]> {
  const embedding = await generateEmbedding(deps.openai, query);

  const [bm25Rows, vectorRows] = await Promise.all([
    bm25Search(deps.pool, query, topK * 2),
    vectorSearch(deps.pool, embedding, topK * 2),
  ]);

  return rrfMerge(bm25Rows, vectorRows, topK);
}

async function bm25Search(
  pool: Pool,
  query: string,
  limit: number
): Promise<Array<{ content: string; source_path: string; hash: string }>> {
  const result = await pool.query<{
    content: string;
    source_path: string;
    hash: string;
  }>(
    `SELECT content, source_path, hash
     FROM document_chunks
     WHERE search_vector @@ plainto_tsquery('english', $1)
     ORDER BY ts_rank_cd(search_vector, plainto_tsquery('english', $1)) DESC
     LIMIT $2`,
    [query, limit]
  );
  return result.rows;
}

async function vectorSearch(
  pool: Pool,
  embedding: number[],
  limit: number
): Promise<Array<{ content: string; source_path: string; hash: string }>> {
  const result = await pool.query<{
    content: string;
    source_path: string;
    hash: string;
  }>(
    `SELECT content, source_path, hash
     FROM document_chunks
     ORDER BY embedding <=> $1::vector
     LIMIT $2`,
    [JSON.stringify(embedding), limit]
  );
  return result.rows;
}

function rrfMerge(
  bm25: Array<{ content: string; source_path: string; hash: string }>,
  vector: Array<{ content: string; source_path: string; hash: string }>,
  topK: number
): RetrievedChunk[] {
  const scores = new Map<string, { chunk: (typeof bm25)[0]; score: number; bm25: number; vec: number }>();

  bm25.forEach((row, i) => {
    const s = 1 / (RRF_K + i + 1);
    scores.set(row.hash, { chunk: row, score: s, bm25: s, vec: 0 });
  });

  vector.forEach((row, i) => {
    const s = 1 / (RRF_K + i + 1);
    const existing = scores.get(row.hash);
    if (existing) {
      existing.score += s;
      existing.vec = s;
    } else {
      scores.set(row.hash, { chunk: row, score: s, bm25: 0, vec: s });
    }
  });

  return [...scores.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map(({ chunk, score, bm25, vec }) => ({
      content: chunk.content,
      sourcePath: chunk.source_path,
      hash: chunk.hash,
      score,
      bm25Score: bm25,
      vectorScore: vec,
    }));
}
