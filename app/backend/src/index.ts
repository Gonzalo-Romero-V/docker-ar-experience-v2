import { existsSync } from 'fs';
import Fastify from 'fastify';
import envPlugin from './plugins/env.js';
import dbPlugin from './plugins/db.js';
import openaiPlugin from './plugins/openai.js';
import corsPlugin from './plugins/cors.js';
import healthRoute from './routes/health.js';
import askRoute from './routes/ask.js';
import ingestRoute from './routes/ingest.js';
import ttsRoute from './routes/tts.js';
import { ingestDocuments } from '@rag/ingest.js';

const fastify = Fastify({ logger: true });

await fastify.register(envPlugin);
await fastify.register(dbPlugin);
await fastify.register(openaiPlugin);
await fastify.register(corsPlugin);

await fastify.register(healthRoute);
await fastify.register(askRoute);
await fastify.register(ingestRoute);
await fastify.register(ttsRoute);

const port = fastify.config.PORT;
await fastify.listen({ port, host: '0.0.0.0' });

// Auto-ingest bundled docs if the knowledge base is empty.
// Runs after listen() so the server is ready to serve health checks while ingesting.
const AUTO_INGEST_DIR = '/app/docs';
if (existsSync(AUTO_INGEST_DIR)) {
  try {
    const { rows } = await fastify.db.query<{ n: string }>(
      'SELECT COUNT(*)::text AS n FROM document_chunks'
    );
    if (Number(rows[0].n) === 0) {
      fastify.log.info('[auto-ingest] Knowledge base is empty — ingesting bundled docs...');
      const result = await ingestDocuments({
        pool: fastify.db,
        openai: fastify.openai,
        docsDir: AUTO_INGEST_DIR,
      });
      fastify.log.info(`[auto-ingest] Done — indexed: ${result.indexed}, skipped: ${result.skipped}`);
    } else {
      fastify.log.info(`[auto-ingest] KB already has ${rows[0].n} chunks — skipping.`);
    }
  } catch (err) {
    fastify.log.warn({ err }, '[auto-ingest] failed — server continues without KB');
  }
}
