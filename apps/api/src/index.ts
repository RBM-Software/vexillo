import { Hono } from 'hono';
import { createDbClient } from '@vexillo/db';
import { createSdkRouter } from './routes/sdk';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

const db = createDbClient(DATABASE_URL, { max: 10 });

const app = new Hono();

// Health check — used by App Runner and CloudFront origin health checks
app.get('/health', (c) => c.json({ status: 'ok' }));

// SDK routes — public, CORS *, CDN-cacheable
app.route('/api/sdk', createSdkRouter(db));

const port = Number(process.env.PORT ?? 3000);

export default {
  port,
  fetch: app.fetch,
};
