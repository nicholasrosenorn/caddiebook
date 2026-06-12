import { eq } from 'drizzle-orm';
import { createMiddleware } from 'hono/factory';

import { db } from '../db/client';
import { users } from '../db/schema';
import { verifySessionToken } from './jwt';

// Hono env shared by authenticated routes: handlers read c.get('userId').
export type AppEnv = { Variables: { userId: string } };

// Require a valid Bearer access token; 401 otherwise. On success the verified
// user id is stashed for downstream handlers (every /sync query scopes to it).
// A banned account is rejected with 403 so a moderation ban ejects the user
// from every read and write (App Store Guideline 1.2 "eject the user").
export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const header = c.req.header('Authorization') ?? '';
  const match = header.match(/^Bearer (.+)$/);
  if (!match) {
    return c.json({ error: 'missing bearer token' }, 401);
  }
  let userId: string;
  try {
    userId = await verifySessionToken(match[1]!, 'access');
  } catch {
    return c.json({ error: 'invalid token' }, 401);
  }
  const row = (
    await db.select({ bannedAt: users.bannedAt }).from(users).where(eq(users.id, userId)).limit(1)
  )[0];
  if (row?.bannedAt) {
    return c.json({ error: 'account_banned' }, 403);
  }
  c.set('userId', userId);
  await next();
});
