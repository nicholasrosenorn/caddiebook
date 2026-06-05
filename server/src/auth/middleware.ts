import { createMiddleware } from 'hono/factory';

import { verifySessionToken } from './jwt';

// Hono env shared by authenticated routes: handlers read c.get('userId').
export type AppEnv = { Variables: { userId: string } };

// Require a valid Bearer access token; 401 otherwise. On success the verified
// user id is stashed for downstream handlers (every /sync query scopes to it).
export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const header = c.req.header('Authorization') ?? '';
  const match = header.match(/^Bearer (.+)$/);
  if (!match) {
    return c.json({ error: 'missing bearer token' }, 401);
  }
  try {
    const userId = await verifySessionToken(match[1]!, 'access');
    c.set('userId', userId);
  } catch {
    return c.json({ error: 'invalid token' }, 401);
  }
  await next();
});
