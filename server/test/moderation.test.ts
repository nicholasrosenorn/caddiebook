import { randomUUID } from 'node:crypto';

import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../src/app';
import { signAccessToken } from '../src/auth/jwt';
import { db, pool } from '../src/db/client';
import { contentReports, users } from '../src/db/schema';
import { runMigrations } from '../src/migrate';
import type {
  AdminReportsResponse,
  BlockedUsersResponse,
  FeedResponse,
  IncomingRequestsResponse,
  UserSearchResponse,
} from '../src/wire';

const app = createApp();
const ADMIN_ID = '00000000-0000-0000-0000-0000000000ad';

beforeAll(async () => {
  await runMigrations();
  // Create the admin user with the id the env allowlist trusts.
  await db
    .insert(users)
    .values({ id: ADMIN_ID, username: `admin_${randomUUID().slice(0, 6)}`, email: `admin_${randomUUID()}@t` })
    .onConflictDoNothing();
});

afterAll(async () => {
  await pool.end();
});

async function makeUser(prefix: string): Promise<string> {
  const handle = `${prefix}_${randomUUID().slice(0, 6)}`;
  const row = (await db.insert(users).values({ username: handle, email: `${handle}@t` }).returning())[0]!;
  return row.id;
}

async function handleOf(id: string): Promise<string> {
  return (await db.select().from(users).where(eq(users.id, id)).limit(1))[0]!.username!;
}

async function authed(userId: string, path: string, method = 'GET', body?: unknown): Promise<Response> {
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

// Make A and B friends (A sends, B accepts).
async function befriend(a: string, b: string): Promise<void> {
  await authed(a, '/community/friend-requests', 'POST', { username: await handleOf(b) });
  const inc = (await (await authed(b, '/community/friend-requests/incoming')).json()) as IncomingRequestsResponse;
  const req = inc.requests.find((r) => r.from.id === a)!;
  await authed(b, `/community/friend-requests/${req.id}/accept`, 'POST');
}

async function seedRound(ownerId: string): Promise<string> {
  const id = randomUUID();
  await pool.query(
    `INSERT INTO rounds (id, user_id, course_name, date_played, hole_count, completed_at,
        include_in_handicap, exclude_from_sharing, created_at, updated_at)
     VALUES ($1, $2, 'Test Links', '2026-06-05', 18, '2026-06-05 18:00:00', 1, 0,
        '2026-06-05 12:00:00', '2026-06-05 12:00:00')`,
    [id, ownerId],
  );
  return id;
}

describe('moderation — profanity filter', () => {
  it('rejects a round write with objectionable course_name (422)', async () => {
    const user = randomUUID();
    const res = await authed(user, `/data/rounds/${randomUUID()}`, 'PUT', {
      course_name: 'Fucking Pines',
      date_played: '2026-06-10',
      hole_count: 9,
    });
    expect(res.status).toBe(422);
    expect(((await res.json()) as { error: string }).error).toBe('objectionable_language');
  });

  it('rejects objectionable hole notes but allows clean text', async () => {
    const user = randomUUID();
    const roundId = randomUUID();
    const holeId = randomUUID();
    await authed(user, `/data/rounds/${roundId}`, 'PUT', {
      course_name: 'Clean Links',
      hole_count: 1,
      holes: [{ id: holeId, round_id: roundId, hole_number: 1 }],
    });
    const dirty = await authed(user, `/data/rounds/${roundId}/holes/1`, 'PUT', {
      id: holeId,
      notes: 'what a sh1t hole',
    });
    expect(dirty.status).toBe(422);
    const clean = await authed(user, `/data/rounds/${roundId}/holes/1`, 'PUT', {
      id: holeId,
      notes: 'great approach today',
    });
    expect(clean.status).toBe(200);
  });

  it('rejects an objectionable username on profile update (422)', async () => {
    const user = await makeUser('cleanish');
    const res = await authed(user, '/auth/me', 'PATCH', { username: `cunt_${randomUUID().slice(0, 4)}` });
    expect(res.status).toBe(422);
  });
});

describe('moderation — blocking', () => {
  it('makes a blocked user mutually invisible across search, feed, detail, requests', async () => {
    const a = await makeUser('blocka');
    const b = await makeUser('blockb');
    await befriend(a, b);
    const roundB = await seedRound(b);

    // Pre-block: A sees B's round in the feed.
    let feed = (await (await authed(a, '/community/feed')).json()) as FeedResponse;
    expect(feed.rounds.some((r) => r.id === roundB)).toBe(true);

    // A blocks B.
    expect((await authed(a, `/community/users/${b}/block`, 'POST')).status).toBe(200);

    // Feed no longer shows B's round (block tore down the friendship too).
    feed = (await (await authed(a, '/community/feed')).json()) as FeedResponse;
    expect(feed.rounds.some((r) => r.id === roundB)).toBe(false);

    // Round detail is 404 in both directions.
    expect((await authed(a, `/community/rounds/${b}/${roundB}`)).status).toBe(404);
    const roundA = await seedRound(a);
    expect((await authed(b, `/community/rounds/${a}/${roundA}`)).status).toBe(404);

    // Search hides B from A and A from B.
    const bHandle = await handleOf(b);
    const aHandle = await handleOf(a);
    const aSearch = (await (await authed(a, `/community/users/search?q=${bHandle}`)).json()) as UserSearchResponse;
    expect(aSearch.users.some((u) => u.id === b)).toBe(false);
    const bSearch = (await (await authed(b, `/community/users/search?q=${aHandle}`)).json()) as UserSearchResponse;
    expect(bSearch.users.some((u) => u.id === a)).toBe(false);

    // Neither can send a friend request to the other.
    expect((await authed(a, '/community/friend-requests', 'POST', { username: bHandle })).status).toBe(404);
    expect((await authed(b, '/community/friend-requests', 'POST', { username: aHandle })).status).toBe(404);

    // B appears in A's blocked list; unblocking clears it.
    const blocked = (await (await authed(a, '/community/blocks')).json()) as BlockedUsersResponse;
    expect(blocked.blocked.some((u) => u.id === b)).toBe(true);
    expect((await authed(a, `/community/users/${b}/block`, 'DELETE')).status).toBe(200);
    const after = (await (await authed(a, '/community/blocks')).json()) as BlockedUsersResponse;
    expect(after.blocked.some((u) => u.id === b)).toBe(false);
  });
});

describe('moderation — reports + admin', () => {
  it('files a report and lets an admin remove the content', async () => {
    const reporter = await makeUser('reporter');
    const owner = await makeUser('owner');
    const roundId = await seedRound(owner);

    const filed = await authed(reporter, '/community/reports', 'POST', {
      targetType: 'round',
      targetOwnerId: owner,
      targetRoundId: roundId,
      reason: 'objectionable',
      note: 'bad notes',
    });
    expect(filed.status).toBe(200);

    // Admin sees the open report.
    const queue = (await (await authed(ADMIN_ID, '/admin/reports')).json()) as AdminReportsResponse;
    const report = queue.reports.find((r) => r.targetRoundId === roundId);
    expect(report).toBeTruthy();
    expect(report!.reporter?.id).toBe(reporter);

    // Non-admin is forbidden.
    expect((await authed(reporter, '/admin/reports')).status).toBe(403);

    // Admin removes the content → the round is hard-deleted.
    expect((await authed(ADMIN_ID, `/admin/reports/${report!.id}/resolve`, 'POST', { action: 'remove_content' })).status).toBe(200);
    const gone = await pool.query(`SELECT 1 FROM rounds WHERE user_id = $1 AND id = $2`, [owner, roundId]);
    expect(gone.rowCount).toBe(0);
    const closed = (await db.select().from(contentReports).where(eq(contentReports.id, report!.id)).limit(1))[0]!;
    expect(closed.status).toBe('resolved');
  });

  it('bans a user, ejecting them from all authed requests (403)', async () => {
    const reporter = await makeUser('reporter2');
    const offender = await makeUser('offender');

    await authed(reporter, '/community/reports', 'POST', {
      targetType: 'user',
      targetOwnerId: offender,
      reason: 'harassment',
    });
    const queue = (await (await authed(ADMIN_ID, '/admin/reports')).json()) as AdminReportsResponse;
    const report = queue.reports.find((r) => r.targetOwnerId === offender && r.targetType === 'user')!;

    // Offender can act before the ban.
    expect((await authed(offender, '/community/feed')).status).toBe(200);

    expect((await authed(ADMIN_ID, `/admin/reports/${report.id}/resolve`, 'POST', { action: 'ban_user' })).status).toBe(200);

    // After the ban, every authed request is 403.
    expect((await authed(offender, '/community/feed')).status).toBe(403);
    expect((await authed(offender, `/data/rounds/${randomUUID()}`, 'PUT', { hole_count: 9 })).status).toBe(403);
  });
});
