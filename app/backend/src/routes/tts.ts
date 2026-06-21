import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

const TtsBodySchema = z.object({
  text: z.string().min(1).max(2000),
});

const ttsRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post('/tts', async (request, reply) => {
    const body = TtsBodySchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ error: body.error.flatten() });
    }

    const mp3 = await fastify.openai.audio.speech.create({
      model: 'tts-1',
      voice: 'nova',   // warm, natural — works well in Spanish
      input: body.data.text,
    });

    const buffer = Buffer.from(await mp3.arrayBuffer());
    return reply
      .header('Content-Type', 'audio/mpeg')
      .header('Cache-Control', 'private, max-age=3600')
      .send(buffer);
  });
};

export default ttsRoute;
