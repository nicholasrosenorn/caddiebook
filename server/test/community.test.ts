import { randomUUID } from 'node:crypto';

import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../src/app';
import { signAccessToken } from '../src/auth/jwt';
import { db, pool } from '../src/db/client';
import { users } from '../src/db/schema';
import { runMigrations } from '../src/migrate';
import type {
  FeedResponse,
  IncomingRequestsResponse,
  LikeResponse,
  RequestCountResponse,
  SendRequestResponse,
  UserSearchResponse,
} from '../src/wire';

const app = createApp();

beforeAll(async () => {
  await runMigrations();
});

afterAll(async () => {
  await pool.end();
});

async function makeUser(username: string): Promise<string> {
  const handle = `${username}_${randomUUID().slice(0, 6)}`;
  const row = (await db.insert(users).values({ username: handle, email: `${handle}@t` }).returning())[0]!;
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

// Seed a completed, shareable round + one hole directly via SQL (the community
// API reads synced data; we don't need the sync push path for these tests).
async function seedRound(
  ownerId: string,
  opts: { excluded?: boolean; completed?: boolean } = {},
): Promise<string> {
  const id = randomUUID();
  const completedAt = opts.completed === false ? null : '2026-06-05 18:00:00';
  await pool.query(
    `INSERT INTO rounds (id, user_id, course_name, date_played, hole_count, completed_at,
        include_in_handicap, exclude_from_sharing, created_at, updated_at)
     VALUES ($1, $2, 'Test Links', '2026-06-05', 18, $3, 1, $4, '2026-06-05 12:00:00', '2026-06-05 12:00:00')`,
    [id, ownerId, completedAt, opts.excluded ? 1 : 0],
  );
  await pool.query(
    `INSERT INTO holes (id, user_id, round_id, hole_number, par, score, putts, updated_at)
     VALUES ($1, $2, $3, 1, 4, 4, 2, '2026-06-05 12:00:00')`,
    [randomUUID(), ownerId, id],
  );
  return id;
}

describe('community', () => {
  it('runs the full friend + feed + like flow', async () => {
    const a = await makeUser('alice');
    const b = await makeUser('bob');
    const bHandle = (await db.select().from(users).where(eq(users.id, b)).limit(1))[0]!.username!;

    // A searches for B and sees relation 'none'.
    const search = (await (
      await authed(a, `/community/users/search?q=${bHandle.slice(0, 4)}`)
    ).json()) as UserSearchResponse;
    const found = search.users.find((u) => u.id === b);
    expect(found?.relation).toBe('none');

    // A sends a request to B.
    const send = (await (
      await authed(a, '/community/friend-requests', 'POST', { username: bHandle })
    ).json()) as SendRequestResponse;
    expect(send.status).toBe('pending');

    // B sees the badge count + incoming request, then accepts.
    const count = (await (
      await authed(b, '/community/friend-requests/count')
    ).json()) as RequestCountResponse;
    expect(count.count).toBe(1);
    const incoming = (await (
      await authed(b, '/community/friend-requests/incoming')
    ).json()) as IncomingRequestsResponse;
    expect(incoming.requests).toHaveLength(1);
    const reqId = incoming.requests[0]!.id;
    expect((await authed(b, `/community/friend-requests/${reqId}/accept`, 'POST')).status).toBe(200);

    // A posts a completed, shared round → it appears in B's feed.
    const roundId = await seedRound(a);
    const feed = (await (await authed(b, '/community/feed')).json()) as FeedResponse;
    const item = feed.rounds.find((r) => r.id === roundId);
    expect(item).toBeTruthy();
    expect(item!.ownerId).toBe(a);
    expect(item!.holes).toHaveLength(1);
    expect(item!.likeCount).toBe(0);

    // B likes it.
    const like = (await (
      await authed(b, `/community/rounds/${a}/${roundId}/like`, 'POST')
    ).json()) as LikeResponse;
    expect(like).toEqual({ likeCount: 1, likedByMe: true });

    // Owner A sees the like count via the round detail (own round, not in feed).
    const detailA = (await (
      await authed(a, `/community/rounds/${a}/${roundId}`)
    ).json()) as { likeCount: number };
    expect(detailA.likeCount).toBe(1);

    // B unlikes.
    const unlike = (await (
      await authed(b, `/community/rounds/${a}/${roundId}/like`, 'DELETE')
    ).json()) as LikeResponse;
    expect(unlike).toEqual({ likeCount: 0, likedByMe: false });
  });

  it('excludes hidden and in-progress rounds from the feed', async () => {
    const a = await makeUser('carol');
    const b = await makeUser('dave');
    const aHandle = (await db.select().from(users).where(eq(users.id, a)).limit(1))[0]!.username!;
    // Make them friends (B requests, A accepts).
    await authed(b, '/community/friend-requests', 'POST', { username: aHandle });
    const inc = (await (
      await authed(a, '/community/friend-requests/incoming')
    ).json()) as IncomingRequestsResponse;
    await authed(a, `/community/friend-requests/${inc.requests[0]!.id}/accept`, 'POST');

    const excluded = await seedRound(a, { excluded: true });
    const inProgress = await seedRound(a, { completed: false });
    const shared = await seedRound(a);

    const feed = (await (await authed(b, '/community/feed')).json()) as FeedResponse;
    const ids = feed.rounds.map((r) => r.id);
    expect(ids).toContain(shared);
    expect(ids).not.toContain(excluded);
    expect(ids).not.toContain(inProgress);

    // Liking an excluded round is rejected.
    expect((await authed(b, `/community/rounds/${a}/${excluded}/like`, 'POST')).status).toBe(404);
  });

  it('auto-accepts a reverse-direction request', async () => {
    const a = await makeUser('erin');
    const b = await makeUser('frank');
    const aHandle = (await db.select().from(users).where(eq(users.id, a)).limit(1))[0]!.username!;
    const bHandle = (await db.select().from(users).where(eq(users.id, b)).limit(1))[0]!.username!;

    await authed(a, '/community/friend-requests', 'POST', { username: bHandle });
    const send = (await (
      await authed(b, '/community/friend-requests', 'POST', { username: aHandle })
    ).json()) as SendRequestResponse;
    expect(send.status).toBe('accepted');

    // Both now see each other in the friends list.
    const friends = await (await authed(a, '/community/friends')).json();
    expect(friends.friends.map((f: { id: string }) => f.id)).toContain(b);
  });

  it('rejects self-requests and unknown users', async () => {
    const a = await makeUser('grace');
    const aHandle = (await db.select().from(users).where(eq(users.id, a)).limit(1))[0]!.username!;
    expect((await authed(a, '/community/friend-requests', 'POST', { username: aHandle })).status).toBe(400);
    expect(
      (await authed(a, '/community/friend-requests', 'POST', { username: 'nobody_zzz' })).status,
    ).toBe(404);
  });
});
