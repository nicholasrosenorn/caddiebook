import { Hono } from 'hono';

import { authRoutes } from './auth/routes';
import { communityRoutes } from './community/routes';
import { dataRoutes } from './data/routes';
import { notificationsRoutes } from './notifications/routes';
import { syncRoutes } from './sync/routes';

// Build the Hono app. Factored out of index.ts so integration tests can mount
// it (app.fetch / app.request) without binding a port.
export function createApp() {
  const app = new Hono();
  app.get('/health', (c) => c.json({ ok: true }));
  app.route('/auth', authRoutes);
  app.route('/data', dataRoutes);
  // Legacy sync pipe: kept this release for old app versions and the one-time
  // upgrade flush of unsynced local rows; the new client only talks to /data.
  app.route('/sync', syncRoutes);
  app.route('/community', communityRoutes);
  app.route('/notifications', notificationsRoutes);
  return app;
}
