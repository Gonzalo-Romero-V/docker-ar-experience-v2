import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import OpenAI from 'openai';

declare module 'fastify' {
  interface FastifyInstance {
    openai: OpenAI;
  }
}

const openaiPlugin: FastifyPluginAsync = async (fastify) => {
  const client = new OpenAI({ apiKey: fastify.config.OPENAI_API_KEY });
  fastify.decorate('openai', client);
};

export default fp(openaiPlugin, { name: 'openai', dependencies: ['env'] });
