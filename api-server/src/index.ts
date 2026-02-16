import Fastify from 'fastify';
import cors from '@fastify/cors';
import PQueue from 'p-queue';

const app = Fastify({ logger: true });
const queue = new PQueue({ concurrency: 5 });

await app.register(cors, {
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
});

app.get('/health', async () => ({ status: 'ok' }));

app.get('/api/search/stream', async (req, reply) => {
  reply.raw.setHeader('Content-Type', 'text/event-stream');
  reply.raw.setHeader('Cache-Control', 'no-cache');
  reply.raw.setHeader('Connection', 'keep-alive');

  const send = (data: any) => {
    reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  send({ stage: 'start', message: '开始搜索...' });
  reply.raw.end();
});

const port = Number(process.env.PORT) || 3000;
app.listen({ port, host: '0.0.0.0' });
