import { eq } from 'drizzle-orm';
import { Hono } from 'hono';

import { db } from '../db/client';
import { users } from '../db/schema';
import { env } from '../env';
import type { AuthResponse, RefreshResponse } from '../wire';
import { signAccessToken, signRefreshToken, verifySessionToken } from './jwt';
import { verifyAppleToken, verifyGoogleToken, type ProviderIdentity } from './verify';

type UserRow = typeof users.$inferSelect;

// Find the user for a provider identity, or create one. If the provider sub is
// new but the verified email matches an existing account, link the provider to
// that account rather than forking a duplicate.
async function findOrCreateUser(
  provider: 'apple' | 'google',
  { sub, email }: ProviderIdentity,
): Promise<UserRow> {
  const subColumn = provider === 'apple' ? users.appleSub : users.googleSub;
  const bySub = await db.select().from(users).where(eq(subColumn, sub)).limit(1);
  if (bySub[0]) return bySub[0];

  if (email) {
    const byEmail = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (byEmail[0]) {
      const patch = provider === 'apple' ? { appleSub: sub } : { googleSub: sub };
      const linked = await db.update(users).set(patch).where(eq(users.id, byEmail[0].id)).returning();
      return linked[0]!;
    }
  }

  const values = provider === 'apple' ? { appleSub: sub, email } : { googleSub: sub, email };
  const created = await db.insert(users).values(values).returning();
  return created[0]!;
}

async function issue(user: UserRow): Promise<AuthResponse> {
  const [accessToken, refreshToken] = await Promise.all([
    signAccessToken(user.id),
    signRefreshToken(user.id),
  ]);
  return { accessToken, refreshToken, user: { id: user.id, email: user.email } };
}

export const authRoutes = new Hono();

authRoutes.post('/apple', async (c) => {
  const body = (await c.req.json().catch(() => null)) as { identityToken?: string } | null;
  if (!body?.identityToken) return c.json({ error: 'identityToken required' }, 400);
  let identity: ProviderIdentity;
  try {
    identity = await verifyAppleToken(body.identityToken);
  } catch {
    return c.json({ error: 'invalid Apple token' }, 401);
  }
  return c.json(await issue(await findOrCreateUser('apple', identity)));
});

authRoutes.post('/google', async (c) => {
  const body = (await c.req.json().catch(() => null)) as { idToken?: string } | null;
  if (!body?.idToken) return c.json({ error: 'idToken required' }, 400);
  let identity: ProviderIdentity;
  try {
    identity = await verifyGoogleToken(body.idToken);
  } catch {
    return c.json({ error: 'invalid Google token' }, 401);
  }
  return c.json(await issue(await findOrCreateUser('google', identity)));
});

authRoutes.post('/refresh', async (c) => {
  const body = (await c.req.json().catch(() => null)) as { refreshToken?: string } | null;
  if (!body?.refreshToken) return c.json({ error: 'refreshToken required' }, 400);
  try {
    const userId = await verifySessionToken(body.refreshToken, 'refresh');
    const accessToken = await signAccessToken(userId);
    return c.json<RefreshResponse>({ accessToken });
  } catch {
    return c.json({ error: 'invalid refresh token' }, 401);
  }
});

// Dev-only: mint a session for a fixed local user so sync can be exercised
// end-to-end without real Apple/Google tokens. Mounted only when DEV_AUTH=1.
if (env.devAuth) {
  authRoutes.post('/dev', async (c) => {
    const existing = await db.select().from(users).where(eq(users.email, 'dev@local')).limit(1);
    const user = existing[0] ?? (await db.insert(users).values({ email: 'dev@local' }).returning())[0]!;
    return c.json(await issue(user));
  });
}
