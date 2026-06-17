import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// Forge provider identities without real Apple/Google JWTs: the verifier maps a
// token of the form `sub::email` to that identity, so each test can mint a fresh
// account (unique sub) or hit the email-link path (shared email, new sub).
vi.mock('../src/auth/verify', () => {
  const parse = (token: string) => {
    const [sub, email] = token.split('::');
    return { sub, email: email || null };
  };
  return {
    verifyAppleToken: async (token: string) => parse(token),
    verifyGoogleToken: async (token: string) => parse(token),
  };
});

import { createApp } from '../src/app';
import { pool } from '../src/db/client';
import { runMigrations } from '../src/migrate';
import { resetRateLimits } from '../src/middleware/rate-limit';
import type { AuthResponse } from '../src/wire';

const app = createApp();

beforeAll(async () => {
  await runMigrations();
});

afterAll(async () => {
  await pool.end();
});

beforeEach(() => resetRateLimits());

function signInApple(body: unknown) {
  return app.request('/auth/apple', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function signInGoogle(body: unknown) {
  return app.request('/auth/google', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('provider name on sign-in', () => {
  it('stores the Apple-supplied name on a brand-new account', async () => {
    const res = await signInApple({
      identityToken: `apple-${Date.now()}`,
      firstName: 'Jordan',
      lastName: 'Spieth',
    });
    expect(res.status).toBe(200);
    const { user } = (await res.json()) as AuthResponse;
    expect(user).toMatchObject({ firstName: 'Jordan', lastName: 'Spieth' });
    // username is still null → the client shows onboarding, prefilled.
    expect(user.username).toBeNull();
  });

  it('stores the Google-supplied name on a brand-new account', async () => {
    const res = await signInGoogle({
      idToken: `google-${Date.now()}`,
      firstName: 'Rory',
      lastName: 'McIlroy',
    });
    expect(res.status).toBe(200);
    expect(((await res.json()) as AuthResponse).user).toMatchObject({
      firstName: 'Rory',
      lastName: 'McIlroy',
    });
  });

  it('does not overwrite the name on a subsequent sign-in (Apple omits it)', async () => {
    const token = `apple-keep-${Date.now()}`;
    await signInApple({ identityToken: token, firstName: 'Tiger', lastName: 'Woods' });

    // Apple returns no fullName after the first auth — the stored name must stand.
    const res = await signInApple({ identityToken: token });
    expect(res.status).toBe(200);
    expect(((await res.json()) as AuthResponse).user).toMatchObject({
      firstName: 'Tiger',
      lastName: 'Woods',
    });
  });

  it('does not overwrite the name when linking a provider to an existing account', async () => {
    const email = `link-${Date.now()}@example.com`;
    // First account via Apple, with a name.
    await signInApple({ identityToken: `appleSub::${email}`, firstName: 'Phil', lastName: 'Mickelson' });

    // Same email, new Google sub → links to the existing account. The name Google
    // supplies must NOT clobber the one already on the account.
    const res = await signInGoogle({ idToken: `googleSub::${email}`, firstName: 'Other', lastName: 'Name' });
    expect(res.status).toBe(200);
    expect(((await res.json()) as AuthResponse).user).toMatchObject({
      firstName: 'Phil',
      lastName: 'Mickelson',
    });
  });

  it('trims and caps an over-long name, and normalizes blank to null', async () => {
    const token = `apple-cap-${Date.now()}`;
    const res = await signInApple({
      identityToken: token,
      firstName: `  ${'a'.repeat(200)}  `,
      lastName: '   ',
    });
    expect(res.status).toBe(200);
    const { user } = (await res.json()) as AuthResponse;
    expect(user.firstName).toHaveLength(100);
    expect(user.lastName).toBeNull();
  });

  it('creates an account fine when no name is supplied', async () => {
    const res = await signInApple({ identityToken: `apple-noname-${Date.now()}` });
    expect(res.status).toBe(200);
    const { user } = (await res.json()) as AuthResponse;
    expect(user.firstName).toBeNull();
    expect(user.lastName).toBeNull();
  });
});
