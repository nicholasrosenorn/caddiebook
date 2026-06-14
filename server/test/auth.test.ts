import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { eq } from 'drizzle-orm';

import { createApp } from '../src/app';
import { signAccessToken, verifyRefreshToken } from '../src/auth/jwt';
import { db, pool } from '../src/db/client';
import { refreshTokens, users } from '../src/db/schema';
import { runMigrations } from '../src/migrate';
import { resetRateLimits } from '../src/middleware/rate-limit';
import type { AuthResponse, AuthUser, RefreshResponse } from '../src/wire';

const app = createApp();

beforeAll(async () => {
  await runMigrations();
});

afterAll(async () => {
  await pool.end();
});

// Each test starts from a clean limiter so request counts don't bleed across cases.
beforeEach(() => resetRateLimits());

async function devLogin(): Promise<AuthResponse> {
  const res = await app.request('/auth/dev', { method: 'POST' });
  expect(res.status).toBe(200);
  return (await res.json()) as AuthResponse;
}

async function refresh(refreshToken: string): Promise<Response> {
  return app.request('/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
}

async function patchMe(token: string, body: unknown): Promise<Response> {
  return app.request('/auth/me', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
}

describe('refresh-token rotation', () => {
  it('issues a new refresh token on every refresh', async () => {
    const { refreshToken: rt1 } = await devLogin();

    const res = await refresh(rt1);
    expect(res.status).toBe(200);
    const { accessToken, refreshToken: rt2 } = (await res.json()) as RefreshResponse;
    expect(accessToken).toBeTruthy();
    expect(rt2).toBeTruthy();
    expect(rt2).not.toBe(rt1);

    // The rotated token is valid for a subsequent refresh.
    expect((await refresh(rt2)).status).toBe(200);
  });

  it('re-issues within the reuse grace window without killing the family', async () => {
    const { refreshToken: rt1 } = await devLogin();
    const { refreshToken: rt2 } = (await (await refresh(rt1)).json()) as RefreshResponse;

    // A near-simultaneous replay of the just-rotated rt1 (e.g. a foreground
    // refetch stampede) is benign: it gets fresh tokens, not a 401.
    const replay = await refresh(rt1);
    expect(replay.status).toBe(200);
    const { refreshToken: rt3 } = (await replay.json()) as RefreshResponse;
    expect(rt3).toBeTruthy();

    // The family survives: the legitimately-rotated rt2 still refreshes.
    expect((await refresh(rt2)).status).toBe(200);
  });

  it('detects reuse of a long-rotated token and revokes the whole family', async () => {
    const { refreshToken: rt1 } = await devLogin();
    const { refreshToken: rt2 } = (await (await refresh(rt1)).json()) as RefreshResponse;

    // Age rt1's revocation past the grace window so the replay reads as theft.
    const { jti } = await verifyRefreshToken(rt1);
    await db
      .update(refreshTokens)
      .set({ revokedAt: new Date(Date.now() - 60_000) })
      .where(eq(refreshTokens.id, jti));

    // Replaying the long-rotated rt1 is treated as theft → 401...
    expect((await refresh(rt1)).status).toBe(401);
    // ...and it nukes the family, so the legitimately-rotated rt2 dies too.
    expect((await refresh(rt2)).status).toBe(401);
  });

  it('rejects an unknown / malformed refresh token', async () => {
    expect((await refresh('not-a-real-token')).status).toBe(401);
  });

  it('logout revokes the family server-side', async () => {
    const { refreshToken } = await devLogin();

    const out = await app.request('/auth/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    expect(out.status).toBe(200);

    // The refresh token is dead after logout.
    expect((await refresh(refreshToken)).status).toBe(401);
  });

  it('logout is best-effort: 200 even with a junk token', async () => {
    const out = await app.request('/auth/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: 'garbage' }),
    });
    expect(out.status).toBe(200);
  });
});

describe('profile (/auth/me)', () => {
  it('requires authentication', async () => {
    expect((await app.request('/auth/me')).status).toBe(401);
    expect((await patchMe('not-a-token', { username: 'whoever' })).status).toBe(401);
  });

  it('updates and echoes the profile, then GET reflects it', async () => {
    const { accessToken } = await devLogin();
    const username = 'caddiemaster';

    const res = await patchMe(accessToken, {
      firstName: 'Jordan',
      lastName: 'Spieth',
      username,
      avatar: 'figure.golf',
    });
    expect(res.status).toBe(200);
    const updated = (await res.json()) as AuthUser;
    expect(updated).toMatchObject({
      firstName: 'Jordan',
      lastName: 'Spieth',
      username,
      avatar: 'figure.golf',
    });

    const me = await app.request('/auth/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(me.status).toBe(200);
    expect(((await me.json()) as AuthUser).username).toBe(username);
  });

  it('rejects a malformed username with 400', async () => {
    const { accessToken } = await devLogin();
    expect((await patchMe(accessToken, { username: 'no' })).status).toBe(400);
    expect((await patchMe(accessToken, { username: 'Has Spaces' })).status).toBe(400);
  });

  it('returns 409 when the username is already taken by another account', async () => {
    // The dev user owns `caddiemaster` (set above / re-set idempotently here).
    const { accessToken: devToken } = await devLogin();
    expect((await patchMe(devToken, { username: 'caddiemaster' })).status).toBe(200);

    // A distinct account trying to claim the same handle is rejected.
    const other = (
      await db.insert(users).values({ email: `other-${Date.now()}@local` }).returning()
    )[0]!;
    const otherToken = await signAccessToken(other.id);
    expect((await patchMe(otherToken, { username: 'caddiemaster' })).status).toBe(409);
  });
});
