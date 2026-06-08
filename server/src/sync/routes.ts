import { Hono } from 'hono';

import { requireAuth, type AppEnv } from '../auth/middleware';
import { rateLimit } from '../middleware/rate-limit';
import { dispatchRoundShareNotifications } from '../notifications/dispatch';
import type { PushRequest } from '../wire';
import { DEFAULT_PULL_LIMIT, pullChanges } from './pull';
import { applyPush } from './push';

export const syncRoutes = new Hono<AppEnv>();

// Every sync route requires a valid access token; handlers read the user id.
syncRoutes.use('*', requireAuth);

// Generous per-user cap for bursty syncing (runs after requireAuth so the user
// id is available as the key).
syncRoutes.use(
  '*',
  rateLimit({ name: 'sync', windowMs: 60_000, max: 120, key: (c) => c.get('userId') }),
);

syncRoutes.post('/push', async (c) => {
  const body = await c.req.json<PushRequest>().catch(() => null);
  if (!body || !Array.isArray(body.changes)) {
    return c.json({ error: 'changes[] required' }, 400);
  }
  const userId = c.get('userId');
  const result = await applyPush(userId, body.changes);
  // Fire-and-forget: a just-completed + shared round notifies the owner's
  // friends. The ledger inside makes this idempotent across re-syncs, and not
  // awaiting keeps sync latency unaffected.
  void dispatchRoundShareNotifications(userId);
  return c.json(result);
});

syncRoutes.get('/pull', async (c) => {
  const sinceRaw = Number(c.req.query('since') ?? '0');
  const limitRaw = Number(c.req.query('limit') ?? String(DEFAULT_PULL_LIMIT));
  const since = Number.isFinite(sinceRaw) && sinceRaw >= 0 ? sinceRaw : 0;
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : DEFAULT_PULL_LIMIT;
  const result = await pullChanges(c.get('userId'), since, limit);
  return c.json(result);
});
