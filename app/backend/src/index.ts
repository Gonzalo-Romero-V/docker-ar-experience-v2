import Fastify from 'fastify';
import envPlugin from './plugins/env.js';
import dbPlugin from './plugins/db.js';
import openaiPlugin from './plugins/openai.js';
import corsPlugin from './plugins/cors.js';
import healthRoute from './routes/health.js';
import askRoute from './routes/ask.js';
import ingestRoute from './routes/ingest.js';

const fastify = Fastify({ logger: true });

await fastify.register(envPlugin);
await fastify.register(dbPlugin);
await fastify.register(openaiPlugin);
await fastify.register(corsPlugin);

await fastify.register(healthRoute);
await fastify.register(askRoute);
await fastify.register(ingestRoute);

const port = fastify.config.PORT;
await fastify.listen({ port, host: '0.0.0.0' });
