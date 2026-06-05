import { Hono } from 'hono';

import { authRoutes } from './auth/routes';
import { syncRoutes } from './sync/routes';

// Build the Hono app. Factored out of index.ts so integration tests can mount
// it (app.fetch / app.request) without binding a port.
export function createApp() {
  const app = new Hono();
  app.get('/health', (c) => c.json({ ok: true }));
  app.route('/auth', authRoutes);
  app.route('/sync', syncRoutes);
  return app;
}
