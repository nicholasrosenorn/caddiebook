import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../src/app';
import { signAccessToken } from '../src/auth/jwt';
import { pool } from '../src/db/client';
import { runMigrations } from '../src/migrate';
import { resetRateLimits } from '../src/middleware/rate-limit';

const app = createApp();

beforeAll(async () => {
  await runMigrations();
});

afterAll(async () => {
  await pool.end();
});

beforeEach(() => resetRateLimits());

describe('rate limiting', () => {
  it('429s the auth endpoints past the per-IP window (30)', async () => {
    let last: Response | undefined;
    for (let i = 0; i < 31; i += 1) {
      last = await app.request('/auth/dev', { method: 'POST' });
    }
    expect(last?.status).toBe(429);
    expect(last?.headers.get('Retry-After')).toBeTruthy();
  });

  it('429s sync past the per-user window (120)', async () => {
    const token = await signAccessToken(randomUUID());
    const headers = { Authorization: `Bearer ${token}` };
    let last: Response | undefined;
    for (let i = 0; i < 121; i += 1) {
      last = await app.request('/sync/pull?since=0', { headers });
    }
    expect(last?.status).toBe(429);
  });
});
