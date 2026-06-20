import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { ingestDocuments } from '@rag/ingest.js';

const IngestBodySchema = z.object({
  docsDir: z.string().min(1),
});

const ingestRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post('/ingest', async (request, reply) => {
    const secret = request.headers['x-ingest-secret'];
    if (secret !== fastify.config.INGEST_SECRET) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const body = IngestBodySchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ error: body.error.flatten() });
    }

    const result = await ingestDocuments({
      pool: fastify.db,
      openai: fastify.openai,
      docsDir: body.data.docsDir,
    });

    return { status: 'ok', ...result };
  });
};

export default ingestRoute;
