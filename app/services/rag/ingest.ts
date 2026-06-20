import type { Pool } from 'pg';
import type OpenAI from 'openai';
import { KB_CONFIG } from './config.js';
import { walkMarkdownFiles } from './parse.js';
import { chunkMarkdown } from './chunk.js';
import { generateEmbedding } from './embed.js';

export async function ingestDocuments(deps: {
  pool: Pool;
  openai: OpenAI;
  docsDir: string;
}): Promise<{ indexed: number; skipped: number }> {
  const files = walkMarkdownFiles(deps.docsDir, KB_CONFIG);
  let indexed = 0;
  let skipped = 0;

  for (const file of files) {
    const chunks = chunkMarkdown(file.content, file.path);

    for (const chunk of chunks) {
      const exists = await deps.pool.query<{ hash: string }>(
        'SELECT hash FROM document_chunks WHERE hash = $1',
        [chunk.hash]
      );

      if (exists.rows.length > 0) {
        skipped++;
        continue;
      }

      const embedding = await generateEmbedding(deps.openai, chunk.content);

      await deps.pool.query(
        `INSERT INTO document_chunks (hash, source_path, content, embedding, search_vector)
         VALUES ($1, $2, $3, $4::vector, to_tsvector('english', $3))
         ON CONFLICT (hash) DO NOTHING`,
        [chunk.hash, chunk.sourcePath, chunk.content, JSON.stringify(embedding)]
      );

      indexed++;
    }
  }

  return { indexed, skipped };
}
