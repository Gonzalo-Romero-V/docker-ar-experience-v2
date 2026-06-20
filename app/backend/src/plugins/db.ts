import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import { Pool } from 'pg';

declare module 'fastify' {
  interface FastifyInstance {
    db: Pool;
  }
}

const dbPlugin: FastifyPluginAsync = async (fastify) => {
  const pool = new Pool({ connectionString: fastify.config.DATABASE_URL });
  await pool.query('SELECT 1');
  fastify.decorate('db', pool);
  fastify.addHook('onClose', async () => pool.end());
};

export default fp(dbPlugin, { name: 'db', dependencies: ['env'] });
