import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { hybridSearch } from '@rag/hybrid.js';
import { deriveConfidence } from '@rag/confidence.js';
import { getCachedResponse, setCachedResponse } from '@rag/cache.js';
import { orchestrateAnswer } from '@llm/orchestrate.js';
import { OpenAIProvider } from '@llm/openai.js';

const AskBodySchema = z.object({
  question: z.string().min(1).max(500),
});

const askRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post('/ask', async (request, reply) => {
    const body = AskBodySchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ error: body.error.flatten() });
    }

    const { question } = body.data;

    const cached = await getCachedResponse(fastify.db, question);
    if (cached) return cached;

    const chunks = await hybridSearch(
      { pool: fastify.db, openai: fastify.openai },
      question
    );
    const confidence = deriveConfidence(chunks);
    const provider = new OpenAIProvider(fastify.openai);
    const envelope = await orchestrateAnswer(provider, question, chunks, confidence);

    await setCachedResponse(fastify.db, question, envelope);
    return envelope;
  });
};

export default askRoute;
