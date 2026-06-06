import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../src/app';
import { pool } from '../src/db/client';
import { runMigrations } from '../src/migrate';
import { resetRateLimits } from '../src/middleware/rate-limit';
import type { AuthResponse, RefreshResponse } from '../src/wire';

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

function refresh(refreshToken: string): Promise<Response> {
  return app.request('/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
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

  it('detects reuse of a rotated token and revokes the whole family', async () => {
    const { refreshToken: rt1 } = await devLogin();
    const { refreshToken: rt2 } = (await (await refresh(rt1)).json()) as RefreshResponse;

    // Replaying the now-rotated rt1 is treated as theft → 401...
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
