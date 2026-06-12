import { sql } from 'drizzle-orm';
import { Hono } from 'hono';

import { requireAuth, type AppEnv } from '../auth/middleware';
import { db } from '../db/client';
import { pushTokens } from '../db/schema';
import { BODY_LIMIT, jsonBodyLimit } from '../middleware/body-limit';
import { rateLimit } from '../middleware/rate-limit';
import type { RegisterPushTokenRequest, UnregisterPushTokenRequest } from '../wire';
import { isExpoPushToken } from './dispatch';

export const notificationsRoutes = new Hono<AppEnv>();

notificationsRoutes.use('*', jsonBodyLimit(BODY_LIMIT.small));
notificationsRoutes.use('*', requireAuth);
notificationsRoutes.use(
  '*',
  rateLimit({ name: 'notifications', windowMs: 60_000, max: 30, key: (c) => c.get('userId') }),
);

// POST /notifications/token { token, platform } — register (or re-assign) a
// device's Expo push token to the signed-in user.
notificationsRoutes.post('/token', async (c) => {
  const me = c.get('userId');
  const body = (await c.req.json().catch(() => null)) as RegisterPushTokenRequest | null;
  const token = typeof body?.token === 'string' ? body.token.trim() : '';
  if (!token || !isExpoPushToken(token)) {
    return c.json({ error: 'valid Expo push token required' }, 400);
  }
  const platform = typeof body?.platform === 'string' ? body.platform : null;
  await db
    .insert(pushTokens)
    .values({ token, userId: me, platform })
    .onConflictDoUpdate({
      target: pushTokens.token,
      set: { userId: me, platform, updatedAt: sql`now()` },
    });
  return c.json({ ok: true });
});

// DELETE /notifications/token { token } — unregister on sign-out. Scoped to the
// caller so one user can't drop another's token.
notificationsRoutes.delete('/token', async (c) => {
  const me = c.get('userId');
  const body = (await c.req.json().catch(() => null)) as UnregisterPushTokenRequest | null;
  const token = typeof body?.token === 'string' ? body.token.trim() : '';
  if (!token) return c.json({ error: 'token required' }, 400);
  await db
    .delete(pushTokens)
    .where(sql`${pushTokens.token} = ${token} AND ${pushTokens.userId} = ${me}`);
  return c.json({ ok: true });
});
