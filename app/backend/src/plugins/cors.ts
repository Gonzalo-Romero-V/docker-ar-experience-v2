import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import cors from '@fastify/cors';

const corsPlugin: FastifyPluginAsync = async (fastify) => {
  await fastify.register(cors, {
    origin: fastify.config.NODE_ENV === 'production' ? false : true,
    methods: ['GET', 'POST', 'OPTIONS'],
  });
};

export default fp(corsPlugin, { name: 'cors', dependencies: ['env'] });
