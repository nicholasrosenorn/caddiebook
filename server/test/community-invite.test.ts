import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../src/app';
import { signAccessToken } from '../src/auth/jwt';
import { db, pool } from '../src/db/client';
import { users } from '../src/db/schema';
import { runMigrations } from '../src/migrate';
import type { FriendsResponse, InviteLinkResponse, RedeemInviteResponse } from '../src/wire';

const app = createApp();

beforeAll(async () => {
  await runMigrations();
});

afterAll(async () => {
  await pool.end();
});

async function makeUser(username: string): Promise<string> {
  const handle = `${username}_${randomUUID().slice(0, 6)}`;
  const row = (
    await db.insert(users).values({ username: handle, email: `${handle}@t` }).returning()
  )[0]!;
  return row.id;
}

async function authed(
  userId: string,
  path: string,
  method = 'GET',
  body?: unknown,
): Promise<Response> {
  const token = await signAccessToken(userId);
  return app.request(path, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function getCode(userId: string): Promise<string> {
  const res = (await (await authed(userId, '/community/invite')).json()) as InviteLinkResponse;
  return res.code;
}

describe('invite links', () => {
  it('returns a stable code and a shareable url', async () => {
    const a = await makeUser('inviteA');
    const first = (await (await authed(a, '/community/invite')).json()) as InviteLinkResponse;
    expect(first.code).toMatch(/^[A-Za-z0-9]{10}$/);
    expect(first.url.endsWith(`/i/${first.code}`)).toBe(true);
    // Stable across calls.
    const second = (await (await authed(a, '/community/invite')).json()) as InviteLinkResponse;
    expect(second.code).toBe(first.code);
  });

  it('auto-friends both users on redeem and is idempotent', async () => {
    const a = await makeUser('inviteOwner');
    const b = await makeUser('inviteRedeemer');
    const code = await getCode(a);

    const redeem = (await (
      await authed(b, '/community/invite/redeem', 'POST', { code })
    ).json()) as RedeemInviteResponse;
    expect(redeem.status).toBe('friended');
    expect(redeem.status === 'friended' && redeem.friend.id).toBe(a);

    // Both sides now see the friendship.
    const friendsA = (await (await authed(a, '/community/friends')).json()) as FriendsResponse;
    expect(friendsA.friends.map((f) => f.id)).toContain(b);
    const friendsB = (await (await authed(b, '/community/friends')).json()) as FriendsResponse;
    expect(friendsB.friends.map((f) => f.id)).toContain(a);

    // Redeeming again is a no-op reporting the existing friendship.
    const again = (await (
      await authed(b, '/community/invite/redeem', 'POST', { code })
    ).json()) as RedeemInviteResponse;
    expect(again.status).toBe('already');
  });

  it('reports self-redeem and rejects unknown codes', async () => {
    const a = await makeUser('inviteSelf');
    const code = await getCode(a);
    const self = (await (
      await authed(a, '/community/invite/redeem', 'POST', { code })
    ).json()) as RedeemInviteResponse;
    expect(self.status).toBe('self');

    expect(
      (await authed(a, '/community/invite/redeem', 'POST', { code: 'doesnotexist' })).status,
    ).toBe(404);
  });

  it('hides the inviter from a blocked redeemer', async () => {
    const a = await makeUser('inviteBlocker');
    const b = await makeUser('inviteBlocked');
    const code = await getCode(a);
    // A blocks B.
    await authed(a, `/community/users/${b}/block`, 'POST');
    expect((await authed(b, '/community/invite/redeem', 'POST', { code })).status).toBe(404);
  });
});
