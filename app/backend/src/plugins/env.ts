import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

const EnvSchema = z.object({
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().min(1),
  OPENAI_API_KEY: z.string().min(1),
  INGEST_SECRET: z.string().min(1),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

export type AppConfig = z.infer<typeof EnvSchema>;

declare module 'fastify' {
  interface FastifyInstance {
    config: AppConfig;
  }
}

const envPlugin: FastifyPluginAsync = async (fastify) => {
  const config = EnvSchema.parse(process.env);
  fastify.decorate('config', config);
};

export default fp(envPlugin, { name: 'env' });
