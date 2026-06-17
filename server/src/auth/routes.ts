import { and, eq, gt, isNull } from 'drizzle-orm';
import { Hono } from 'hono';

import { db, type Db } from '../db/client';
import { refreshTokens, users } from '../db/schema';
import { env } from '../env';
import { containsProfanity } from '../moderation/profanity';
import type {
  AppleAuthRequest,
  AuthResponse,
  AuthUser,
  GoogleAuthRequest,
  ProfileUpdate,
  RefreshResponse,
} from '../wire';
import {
  REFRESH_TTL_MS,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  type RefreshClaims,
} from './jwt';
import { requireAuth, type AppEnv } from './middleware';
import { verifyAppleToken, verifyGoogleToken, type ProviderIdentity } from './verify';
import { clientIp, rateLimit } from '../middleware/rate-limit';
import { BODY_LIMIT, jsonBodyLimit } from '../middleware/body-limit';

type UserRow = typeof users.$inferSelect;

// Project a user row to the public profile shape the client persists in its
// session. Never leak the provider subs or internal timestamps.
function toAuthUser(user: UserRow): AuthUser {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    username: user.username,
    avatar: user.avatar,
  };
}
// The handle passed to db.transaction's callback — lets helpers run on either
// the root connection or inside a transaction.
type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

// A name the provider handed us at sign-in (Apple `fullName`, Google profile).
// Trimmed + length-capped to match the /auth/me profile cap.
type ProviderName = { firstName: string | null; lastName: string | null };

function sanitizeName(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().slice(0, 100);
  return trimmed.length > 0 ? trimmed : null;
}

// Find the user for a provider identity, or create one. If the provider sub is
// new but the verified email matches an existing account, link the provider to
// that account rather than forking a duplicate. `name` is only used on the
// create path — it seeds a new account's profile (Apple shares the name only on
// first auth) and must never overwrite an existing/edited name.
async function findOrCreateUser(
  provider: 'apple' | 'google',
  { sub, email }: ProviderIdentity,
  name: ProviderName = { firstName: null, lastName: null },
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

  const base = provider === 'apple' ? { appleSub: sub, email } : { googleSub: sub, email };
  const created = await db
    .insert(users)
    .values({ ...base, firstName: name.firstName, lastName: name.lastName })
    .returning();
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

// True if the family still holds a non-revoked, unexpired token — i.e. a normal
// rotation left a usable successor. False after theft/logout revoked the family.
async function familyHasLiveToken(familyId: string): Promise<boolean> {
  const live = await db
    .select({ id: refreshTokens.id })
    .from(refreshTokens)
    .where(
      and(
        eq(refreshTokens.familyId, familyId),
        isNull(refreshTokens.revokedAt),
        gt(refreshTokens.expiresAt, new Date()),
      ),
    )
    .limit(1);
  return live.length > 0;
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
  return { accessToken, refreshToken, user: toAuthUser(user) };
}

export const authRoutes = new Hono<AppEnv>();

authRoutes.use('*', jsonBodyLimit(BODY_LIMIT.small));
// Throttle token endpoints per client IP to blunt brute-force / token grinding.
authRoutes.use('*', rateLimit({ name: 'auth', windowMs: 5 * 60_000, max: 30, key: clientIp }));

authRoutes.post('/apple', async (c) => {
  const body = (await c.req.json().catch(() => null)) as Partial<AppleAuthRequest> | null;
  if (!body?.identityToken) return c.json({ error: 'identityToken required' }, 400);
  let identity: ProviderIdentity;
  try {
    identity = await verifyAppleToken(body.identityToken);
  } catch {
    return c.json({ error: 'invalid Apple token' }, 401);
  }
  const name = { firstName: sanitizeName(body.firstName), lastName: sanitizeName(body.lastName) };
  return c.json(await issue(await findOrCreateUser('apple', identity, name)));
});

authRoutes.post('/google', async (c) => {
  const body = (await c.req.json().catch(() => null)) as Partial<GoogleAuthRequest> | null;
  if (!body?.idToken) return c.json({ error: 'idToken required' }, 400);
  let identity: ProviderIdentity;
  try {
    identity = await verifyGoogleToken(body.idToken);
  } catch {
    return c.json({ error: 'invalid Google token' }, 401);
  }
  const name = { firstName: sanitizeName(body.firstName), lastName: sanitizeName(body.lastName) };
  return c.json(await issue(await findOrCreateUser('google', identity, name)));
});

// Reuse grace window: a refresh token revoked this recently is treated as a
// benign concurrent replay (a network retry, a second in-flight request, or a
// brief multi-device overlap) rather than theft. Within the window we re-issue
// in the same family instead of killing it; a replay long after rotation still
// trips theft detection below. Keeps rotation robust without weakening it.
const REFRESH_REUSE_GRACE_MS = 30_000;

// Rotating refresh: verify the token against the store, then revoke it and mint
// a replacement in the same family. Replaying an already-revoked token is treated
// as theft and kills the whole family — except within the brief reuse grace
// window above. Legacy tokens without a jti fail verify → 401 → re-auth.
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
    // A near-simultaneous replay of a just-rotated token is benign (a foreground
    // refetch stampede, a network retry): re-issue in the same family instead of
    // treating it as theft. Two conditions must both hold:
    //   1. revoked within the grace window — a delayed replay is real theft; and
    //   2. the family still has a live successor — a normal rotation always
    //      leaves one, whereas theft detection and logout revoke the whole
    //      family, so a sibling replayed right after must NOT resurrect it.
    const fresh =
      Date.now() - row.revokedAt.getTime() <= REFRESH_REUSE_GRACE_MS &&
      (await familyHasLiveToken(claims.familyId));
    if (fresh) {
      const [accessToken, refreshToken] = await Promise.all([
        signAccessToken(claims.userId),
        mintRefreshToken(claims.userId, claims.familyId),
      ]);
      return c.json<RefreshResponse>({ accessToken, refreshToken });
    }
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

// --- Profile (authenticated) -----------------------------------------------

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
// Length ceilings on the free-text profile fields (avatar is a short icon-name
// identifier, not a URL/blob). Blunts storage abuse on the users table.
const MAX_NAME_LEN = 100;
const MAX_AVATAR_LEN = 256;

// Current account's profile. Lets the client refresh what it cached at sign-in
// (e.g. edits made on another device).
authRoutes.get('/me', requireAuth, async (c) => {
  const userId = c.get('userId');
  const row = (await db.select().from(users).where(eq(users.id, userId)).limit(1))[0];
  if (!row) return c.json({ error: 'user not found' }, 404);
  return c.json(toAuthUser(row));
});

// Set the account profile (onboarding + later edits). Username is normalised to
// lowercase and must be unique; a clash returns 409 so the UI can prompt for
// another. firstName/lastName/avatar are stored as-is (null clears them).
authRoutes.patch('/me', requireAuth, async (c) => {
  const userId = c.get('userId');
  const body = (await c.req.json().catch(() => null)) as Partial<ProfileUpdate> | null;
  const username = typeof body?.username === 'string' ? body.username.trim().toLowerCase() : '';
  if (!USERNAME_RE.test(username)) {
    return c.json({ error: 'username must be 3-20 chars: a-z, 0-9, underscore' }, 400);
  }
  if (
    (typeof body?.firstName === 'string' && body.firstName.length > MAX_NAME_LEN) ||
    (typeof body?.lastName === 'string' && body.lastName.length > MAX_NAME_LEN)
  ) {
    return c.json({ error: `name must be at most ${MAX_NAME_LEN} characters` }, 400);
  }
  if (typeof body?.avatar === 'string' && body.avatar.length > MAX_AVATAR_LEN) {
    return c.json({ error: `avatar must be at most ${MAX_AVATAR_LEN} characters` }, 400);
  }
  // The handle and names are visible to other users (search, feed, requests),
  // so they pass the same objectionable-language gate as shared round text.
  if (
    containsProfanity(username) ||
    containsProfanity(body?.firstName) ||
    containsProfanity(body?.lastName)
  ) {
    return c.json({ error: 'objectionable_language' }, 422);
  }

  // Pre-check keeps the common case a clean 409; the unique index is the source
  // of truth and a racing insert still surfaces below via the 23505 catch.
  const clash = (
    await db.select({ id: users.id }).from(users).where(eq(users.username, username)).limit(1)
  )[0];
  if (clash && clash.id !== userId) return c.json({ error: 'username taken' }, 409);

  const patch = {
    firstName: typeof body?.firstName === 'string' ? body.firstName.trim() || null : null,
    lastName: typeof body?.lastName === 'string' ? body.lastName.trim() || null : null,
    username,
    avatar: typeof body?.avatar === 'string' ? body.avatar : null,
  };

  try {
    const updated = await db.update(users).set(patch).where(eq(users.id, userId)).returning();
    if (!updated[0]) return c.json({ error: 'user not found' }, 404);
    return c.json(toAuthUser(updated[0]));
  } catch (e) {
    if (e && typeof e === 'object' && 'code' in e && e.code === '23505') {
      return c.json({ error: 'username taken' }, 409);
    }
    throw e;
  }
});

// Dev-only: mint a session for a fixed local user so sync can be exercised
// end-to-end without real Apple/Google tokens. Mounted only when DEV_AUTH=1.
if (env.devAuth) {
  authRoutes.post('/dev', async (c) => {
    // Optional { email } lets tests/local use mint distinct users so the
    // community flows can be exercised between two accounts.
    const body = (await c.req.json().catch(() => null)) as { email?: string } | null;
    const email = typeof body?.email === 'string' && body.email.trim() ? body.email.trim() : 'dev@local';
    const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
    const user = existing[0] ?? (await db.insert(users).values({ email }).returning())[0]!;
    return c.json(await issue(user));
  });
}
