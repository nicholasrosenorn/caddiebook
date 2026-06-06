import { and, eq, isNull } from 'drizzle-orm';
import { Hono } from 'hono';

import { db, type Db } from '../db/client';
import { refreshTokens, users } from '../db/schema';
import { env } from '../env';
import type { AuthResponse, RefreshResponse } from '../wire';
import {
  REFRESH_TTL_MS,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  type RefreshClaims,
} from './jwt';
import { verifyAppleToken, verifyGoogleToken, type ProviderIdentity } from './verify';
import { clientIp, rateLimit } from '../middleware/rate-limit';

type UserRow = typeof users.$inferSelect;
// The handle passed to db.transaction's callback — lets helpers run on either
// the root connection or inside a transaction.
type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

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

// Record a refresh token (id = jti) and sign it. `tx` lets rotation run the
// insert inside the same transaction that revokes the old token.
async function mintRefreshToken(
  userId: string,
  familyId: string,
  conn: Db | Tx = db,
): Promise<string> {
  const jti = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + REFRESH_TTL_MS);
  await conn.insert(refreshTokens).values({ id: jti, userId, familyId, expiresAt });
  return signRefreshToken(userId, jti, familyId);
}

// Revoke every still-live token in a rotation family (sign-out / theft).
async function revokeFamily(familyId: string, conn: Db | Tx = db): Promise<void> {
  await conn
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(refreshTokens.familyId, familyId), isNull(refreshTokens.revokedAt)));
}

async function issue(user: UserRow): Promise<AuthResponse> {
  const familyId = crypto.randomUUID();
  const [accessToken, refreshToken] = await Promise.all([
    signAccessToken(user.id),
    mintRefreshToken(user.id, familyId),
  ]);
  return { accessToken, refreshToken, user: { id: user.id, email: user.email } };
}

export const authRoutes = new Hono();

// Throttle token endpoints per client IP to blunt brute-force / token grinding.
authRoutes.use('*', rateLimit({ name: 'auth', windowMs: 5 * 60_000, max: 30, key: clientIp }));

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

// Rotating refresh: verify the token against the store, then revoke it and mint
// a replacement in the same family. Replaying an already-revoked token is treated
// as theft and kills the whole family. Legacy tokens without a jti fail verify →
// 401 → the client re-authenticates.
authRoutes.post('/refresh', async (c) => {
  const body = (await c.req.json().catch(() => null)) as { refreshToken?: string } | null;
  if (!body?.refreshToken) return c.json({ error: 'refreshToken required' }, 400);

  let claims: RefreshClaims;
  try {
    claims = await verifyRefreshToken(body.refreshToken);
  } catch {
    return c.json({ error: 'invalid refresh token' }, 401);
  }

  const row = (
    await db.select().from(refreshTokens).where(eq(refreshTokens.id, claims.jti)).limit(1)
  )[0];
  if (!row) return c.json({ error: 'invalid refresh token' }, 401);
  if (row.revokedAt) {
    await revokeFamily(claims.familyId);
    return c.json({ error: 'refresh token revoked' }, 401);
  }
  if (row.expiresAt.getTime() < Date.now()) {
    return c.json({ error: 'refresh token expired' }, 401);
  }

  const tokens = await db.transaction(async (tx) => {
    await tx
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.id, claims.jti));
    const [accessToken, refreshToken] = await Promise.all([
      signAccessToken(claims.userId),
      mintRefreshToken(claims.userId, claims.familyId, tx),
    ]);
    return { accessToken, refreshToken };
  });

  return c.json<RefreshResponse>(tokens);
});

// Sign-out: revoke the family of the presented refresh token. Best-effort and
// always 200 so the client can clear its session even offline or with a stale
// token (the refresh token itself authorizes the revoke — no access token needed).
authRoutes.post('/logout', async (c) => {
  const body = (await c.req.json().catch(() => null)) as { refreshToken?: string } | null;
  if (body?.refreshToken) {
    try {
      const { familyId } = await verifyRefreshToken(body.refreshToken);
      await revokeFamily(familyId);
    } catch {
      // Invalid/expired token — nothing to revoke.
    }
  }
  return c.json({ ok: true });
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
