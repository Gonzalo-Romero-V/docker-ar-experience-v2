import { createHash } from 'crypto';
import type { Pool } from 'pg';
import type { ResponseEnvelope } from '@shared/envelope.js';

function normalizeQuery(query: string): string {
  return query.toLowerCase().trim().replace(/\s+/g, ' ');
}

function queryHash(query: string): string {
  return createHash('sha256').update(normalizeQuery(query)).digest('hex');
}

export async function getCachedResponse(
  pool: Pool,
  query: string
): Promise<ResponseEnvelope | null> {
  const result = await pool.query<{ envelope: ResponseEnvelope }>(
    'SELECT envelope FROM query_cache WHERE hash = $1',
    [queryHash(query)]
  );
  return result.rows[0]?.envelope ?? null;
}

export async function setCachedResponse(
  pool: Pool,
  query: string,
  envelope: ResponseEnvelope
): Promise<void> {
  await pool.query(
    `INSERT INTO query_cache (hash, query, envelope, created_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (hash) DO UPDATE SET envelope = EXCLUDED.envelope, created_at = NOW()`,
    [queryHash(query), normalizeQuery(query), JSON.stringify(envelope)]
  );
}
