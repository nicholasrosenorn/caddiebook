import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../src/app';
import { signAccessToken } from '../src/auth/jwt';
import { pool } from '../src/db/client';
import { resetRateLimits } from '../src/middleware/rate-limit';
import { runMigrations } from '../src/migrate';
import type {
  DataRoundsResponse,
  RoundFullResponse,
  StatsBundleResponse,
} from '../src/wire';

const app = createApp();

beforeAll(async () => {
  await runMigrations();
});

afterAll(async () => {
  await pool.end();
});

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

function holeRows(roundId: string, count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: randomUUID(),
    round_id: roundId,
    hole_number: i + 1,
  }));
}

// Create a round (with pre-created holes, like the client does) and return ids.
async function createRound(userId: string, holeCount = 9) {
  const roundId = randomUUID();
  const holes = holeRows(roundId, holeCount);
  const res = await authed(userId, `/data/rounds/${roundId}`, 'PUT', {
    course_name: 'Test Links',
    date_played: '2026-06-10',
    hole_count: holeCount,
    created_at: '2026-06-10 12:00:00',
    holes,
  });
  expect(res.status).toBe(200);
  return { roundId, holes };
}

async function getFull(userId: string, roundId: string): Promise<RoundFullResponse> {
  const res = await authed(userId, `/data/rounds/${roundId}/full`);
  expect(res.status).toBe(200);
  return (await res.json()) as RoundFullResponse;
}

describe('/data rounds', () => {
  it('creates a round with embedded holes and reads it back fully', async () => {
    const user = randomUUID();
    const { roundId } = await createRound(user, 9);

    const full = await getFull(user, roundId);
    expect(full.round.course_name).toBe('Test Links');
    expect(full.holes).toHaveLength(9);
    expect(full.holes[0]?.hole_number).toBe(1);
    expect(full.shots).toHaveLength(0);
    expect(full.review).toBeNull();

    const list = (await (await authed(user, '/data/rounds')).json()) as DataRoundsResponse;
    expect(list.rounds).toHaveLength(1);
    expect(list.rounds[0]?.holes).toHaveLength(9);
  });

  it('replaying the same round PUT is a no-op (idempotent create)', async () => {
    const user = randomUUID();
    const roundId = randomUUID();
    const holes = holeRows(roundId, 9);
    const body = { course_name: 'Replay GC', hole_count: 9, holes };
    await authed(user, `/data/rounds/${roundId}`, 'PUT', body);
    await authed(user, `/data/rounds/${roundId}`, 'PUT', body);

    const full = await getFull(user, roundId);
    expect(full.holes).toHaveLength(9);
  });

  it('patches round fields without clobbering others', async () => {
    const user = randomUUID();
    const { roundId } = await createRound(user);
    const res = await authed(user, `/data/rounds/${roundId}`, 'PUT', {
      include_in_handicap: 0,
    });
    expect(res.status).toBe(200);
    const full = await getFull(user, roundId);
    expect(full.round.include_in_handicap).toBe(0);
    expect(full.round.course_name).toBe('Test Links'); // untouched
  });

  it('hard-deletes a round and all children; repeat delete still 200', async () => {
    const user = randomUUID();
    const { roundId, holes } = await createRound(user);
    await authed(user, `/data/rounds/${roundId}/holes/1/shots/driver`, 'PUT', {
      id: randomUUID(),
      x_norm: 0.5,
      y_norm: 0.5,
    });
    await authed(user, `/data/putts/${randomUUID()}`, 'PUT', {
      round_id: roundId,
      hole_number: 1,
      distance_ft: 10,
      made: 1,
    });
    expect(holes).toHaveLength(9);

    const del = await authed(user, `/data/rounds/${roundId}`, 'DELETE');
    expect(del.status).toBe(200);
    expect((await authed(user, `/data/rounds/${roundId}/full`)).status).toBe(404);

    const stats = (await (await authed(user, '/data/stats')).json()) as StatsBundleResponse;
    expect(stats.rounds).toHaveLength(0);
    expect(stats.holes).toHaveLength(0);
    expect(stats.shots).toHaveLength(0);
    expect(stats.putts).toHaveLength(0);

    expect((await authed(user, `/data/rounds/${roundId}`, 'DELETE')).status).toBe(200);
  });

  it('isolates users', async () => {
    const a = randomUUID();
    const b = randomUUID();
    const { roundId } = await createRound(a);

    expect((await authed(b, `/data/rounds/${roundId}/full`)).status).toBe(404);
    // B "deleting" A's round must not touch it.
    await authed(b, `/data/rounds/${roundId}`, 'DELETE');
    expect((await authed(a, `/data/rounds/${roundId}/full`)).status).toBe(200);
  });
});

describe('/data holes & shots', () => {
  it('patches a hole by number; replay is a no-op', async () => {
    const user = randomUUID();
    const { roundId, holes } = await createRound(user);
    const patch = { id: holes[2]!.id, par: 4, score: 5 };
    await authed(user, `/data/rounds/${roundId}/holes/3`, 'PUT', patch);
    await authed(user, `/data/rounds/${roundId}/holes/3`, 'PUT', patch);

    const full = await getFull(user, roundId);
    const hole3 = full.holes.find((h) => h.hole_number === 3);
    expect(hole3?.par).toBe(4);
    expect(hole3?.score).toBe(5);
    // Only the targeted hole changed, and no duplicate rows appeared.
    expect(full.holes).toHaveLength(9);
  });

  it('upserts a shot slot and applies the hole patch atomically', async () => {
    const user = randomUUID();
    const { roundId } = await createRound(user);

    await authed(user, `/data/rounds/${roundId}/holes/1/shots/driver`, 'PUT', {
      id: randomUUID(),
      x_norm: 0.2,
      y_norm: 0.4,
      hole: { fir: 0 },
    });
    let full = await getFull(user, roundId);
    expect(full.shots).toHaveLength(1);
    expect(full.holes[0]?.fir).toBe(0);

    // Re-placing the drive replaces the slot (no second row) + re-derives fir.
    await authed(user, `/data/rounds/${roundId}/holes/1/shots/driver`, 'PUT', {
      id: randomUUID(),
      x_norm: 0.5,
      y_norm: 0.5,
      hole: { fir: 1 },
    });
    full = await getFull(user, roundId);
    expect(full.shots).toHaveLength(1);
    expect(full.shots[0]?.x_norm).toBe(0.5);
    expect(full.holes[0]?.fir).toBe(1);

    // Deleting the slot clears it and applies the embedded hole patch.
    await authed(user, `/data/rounds/${roundId}/holes/1/shots/driver`, 'DELETE', {
      hole: { fir: null },
    });
    full = await getFull(user, roundId);
    expect(full.shots).toHaveLength(0);
    expect(full.holes[0]?.fir).toBeNull();
  });
});

describe('/data putts', () => {
  it('recounts holes.putts on create and delete; replay does not double-count', async () => {
    const user = randomUUID();
    const { roundId } = await createRound(user);

    const missId = randomUUID();
    const miss = { round_id: roundId, hole_number: 2, distance_ft: 15, made: 0 };
    await authed(user, `/data/putts/${missId}`, 'PUT', miss);
    await authed(user, `/data/putts/${missId}`, 'PUT', miss); // replay
    await authed(user, `/data/putts/${randomUUID()}`, 'PUT', {
      round_id: roundId,
      hole_number: 2,
      distance_ft: 3,
      made: 1,
    });

    let full = await getFull(user, roundId);
    expect(full.putts).toHaveLength(2);
    expect(full.holes.find((h) => h.hole_number === 2)?.putts).toBe(2);

    await authed(user, `/data/putts/${missId}`, 'DELETE');
    full = await getFull(user, roundId);
    expect(full.putts).toHaveLength(1);
    expect(full.holes.find((h) => h.hole_number === 2)?.putts).toBe(1);
  });

  it('a new made putt replaces any other made putt on the hole', async () => {
    const user = randomUUID();
    const { roundId } = await createRound(user);
    await authed(user, `/data/putts/${randomUUID()}`, 'PUT', {
      round_id: roundId,
      hole_number: 1,
      distance_ft: 10,
      made: 1,
    });
    await authed(user, `/data/putts/${randomUUID()}`, 'PUT', {
      round_id: roundId,
      hole_number: 1,
      distance_ft: 3,
      made: 1,
    });
    const full = await getFull(user, roundId);
    expect(full.putts).toHaveLength(1);
    expect(full.putts[0]?.distance_ft).toBe(3);
    expect(full.holes[0]?.putts).toBe(1);
  });
});

describe('/data review, goals, journal, settings, courses', () => {
  it('upserts review and goals keyed by round', async () => {
    const user = randomUUID();
    const { roundId } = await createRound(user);

    await authed(user, `/data/rounds/${roundId}/review`, 'PUT', {
      id: randomUUID(),
      most_costly: 'driver',
      overall_rating: 3,
    });
    // A second submit (edited answers, new client uuid) updates the same row.
    await authed(user, `/data/rounds/${roundId}/review`, 'PUT', {
      id: randomUUID(),
      most_costly: 'putting',
      overall_rating: 4,
    });
    await authed(user, `/data/rounds/${roundId}/goals`, 'PUT', {
      id: randomUUID(),
      execution_goal: 'fairways',
    });

    const full = await getFull(user, roundId);
    expect(full.review?.most_costly).toBe('putting');
    expect(full.review?.overall_rating).toBe(4);
    expect(full.goals?.execution_goal).toBe('fairways');
  });

  it('journal CRUD round-trips', async () => {
    const user = randomUUID();
    const id = randomUUID();
    await authed(user, `/data/journal/${id}`, 'PUT', {
      tag: 'range',
      body: 'worked on tempo',
      created_at: '2026-06-10 09:00:00',
    });
    await authed(user, `/data/journal/${id}`, 'PUT', { body: 'worked on tempo + grip' });

    let res = await (await authed(user, '/data/journal')).json() as { entries: { id: string; body: string }[] };
    expect(res.entries).toHaveLength(1);
    expect(res.entries[0]?.body).toBe('worked on tempo + grip');

    await authed(user, `/data/journal/${id}`, 'DELETE');
    res = await (await authed(user, '/data/journal')).json() as { entries: [] };
    expect(res.entries).toHaveLength(0);
  });

  it('settings PUT/GET round-trips', async () => {
    const user = randomUUID();
    await authed(user, '/data/settings/bag', 'PUT', { value: '["Driver","7i"]' });
    await authed(user, '/data/settings/bag', 'PUT', { value: '["Driver","7i","PW"]' });
    const res = (await (await authed(user, '/data/settings')).json()) as {
      settings: Record<string, string>;
    };
    expect(res.settings.bag).toBe('["Driver","7i","PW"]');
  });

  it('courses and tees upsert and read back embedded', async () => {
    const user = randomUUID();
    const courseId = randomUUID();
    await authed(user, `/data/courses/${courseId}`, 'PUT', { name: 'Augusta Municipal' });
    await authed(user, `/data/tees/${randomUUID()}`, 'PUT', {
      course_id: courseId,
      name: 'Blue',
      course_rating: 71.2,
      slope_rating: 128,
    });
    const res = (await (await authed(user, '/data/courses')).json()) as {
      courses: { id: string; name: string; tees: { name: string }[] }[];
    };
    const course = res.courses.find((c) => c.id === courseId);
    expect(course?.name).toBe('Augusta Municipal');
    expect(course?.tees[0]?.name).toBe('Blue');
  });
});

// Share-notification dispatch behavior (claim/release, recency window, blocks) is
// covered with Expo mocked in test/notifications.test.ts.

describe('/data auth & limits', () => {
  it('rejects unauthenticated requests', async () => {
    expect((await app.request('/data/rounds')).status).toBe(401);
  });

  it('rate-limits the data bucket per user', async () => {
    resetRateLimits();
    const user = randomUUID();
    const token = await signAccessToken(user);
    let last = 200;
    for (let i = 0; i < 601; i++) {
      const res = await app.request('/data/settings', {
        headers: { Authorization: `Bearer ${token}` },
      });
      last = res.status;
    }
    expect(last).toBe(429);
    resetRateLimits();
  });
});

describe('account deletion (DELETE /auth/me)', () => {
  it('erases the user row and every table the account touches', async () => {
    // A real users row so we can assert it is gone afterward.
    const user = randomUUID();
    const friend = randomUUID();
    await pool.query(`INSERT INTO users (id, email) VALUES ($1, $2)`, [user, `${user}@local`]);

    // Per-user data through the API (rounds + holes, a shot, a putt, a setting).
    const { roundId } = await createRound(user, 9);
    expect(
      (await authed(user, `/data/rounds/${roundId}/holes/1/shots/driver`, 'PUT', {
        id: randomUUID(),
        x_norm: 0.5,
        y_norm: 0.5,
      })).status,
    ).toBe(200);
    expect(
      (await authed(user, `/data/putts/${randomUUID()}`, 'PUT', {
        round_id: roundId,
        hole_number: 1,
        distance_ft: 10,
        made: 1,
      })).status,
    ).toBe(200);
    expect((await authed(user, '/data/settings/bag', 'PUT', { value: '[]' })).status).toBe(200);

    // Server-owned social / auth state, inserted directly.
    await pool.query(`INSERT INTO users (id, email) VALUES ($1, $2)`, [friend, `${friend}@local`]);
    await pool.query(
      `INSERT INTO refresh_tokens (id, user_id, family_id, expires_at) VALUES ($1, $2, $3, now() + interval '30 days')`,
      [randomUUID(), user, randomUUID()],
    );
    await pool.query(`INSERT INTO push_tokens (token, user_id) VALUES ($1, $2)`, [
      `ExpoToken[${user}]`,
      user,
    ]);
    const [low, high] = user < friend ? [user, friend] : [friend, user];
    await pool.query(`INSERT INTO friendships (user_low, user_high) VALUES ($1, $2)`, [low, high]);
    await pool.query(
      `INSERT INTO friend_requests (from_user_id, to_user_id) VALUES ($1, $2)`,
      [user, friend],
    );
    await pool.query(
      `INSERT INTO round_likes (round_owner_id, round_id, liker_id) VALUES ($1, $2, $3)`,
      [user, roundId, friend],
    );
    await pool.query(`INSERT INTO user_blocks (blocker_id, blocked_id) VALUES ($1, $2)`, [
      user,
      friend,
    ]);
    await pool.query(
      `INSERT INTO content_reports (reporter_id, target_type, target_owner_id, reason) VALUES ($1, 'user', $2, 'spam')`,
      [user, friend],
    );
    await pool.query(
      `INSERT INTO round_share_notifications (round_owner_id, round_id) VALUES ($1, $2)`,
      [user, roundId],
    );

    // Delete the account.
    const res = await authed(user, '/auth/me', 'DELETE');
    expect(res.status).toBe(200);

    // Nothing belonging to the user remains anywhere.
    const checks: [string, string][] = [
      ['rounds', `user_id = $1`],
      ['holes', `user_id = $1`],
      ['shots', `user_id = $1`],
      ['putts', `user_id = $1`],
      ['app_settings', `user_id = $1`],
      ['refresh_tokens', `user_id = $1`],
      ['push_tokens', `user_id = $1`],
      ['friendships', `user_low = $1 OR user_high = $1`],
      ['friend_requests', `from_user_id = $1 OR to_user_id = $1`],
      ['round_likes', `round_owner_id = $1 OR liker_id = $1`],
      ['user_blocks', `blocker_id = $1 OR blocked_id = $1`],
      ['content_reports', `reporter_id = $1 OR target_owner_id = $1`],
      ['round_share_notifications', `round_owner_id = $1`],
      ['users', `id = $1`],
    ];
    for (const [table, where] of checks) {
      const { rows } = await pool.query(`SELECT count(*)::int AS n FROM ${table} WHERE ${where}`, [
        user,
      ]);
      expect(`${table}:${rows[0].n}`).toBe(`${table}:0`);
    }

    // The friend (only referenced, not the owner) is untouched.
    const { rows: friendRows } = await pool.query(`SELECT count(*)::int AS n FROM users WHERE id = $1`, [
      friend,
    ]);
    expect(friendRows[0].n).toBe(1);

    // A later authenticated request from the deleted user behaves like a fresh
    // account (no leftover data), not an error.
    const after = await authed(user, '/data/rounds');
    expect(after.status).toBe(200);
    expect(((await after.json()) as DataRoundsResponse).rounds).toHaveLength(0);
  });
});

describe('/data input validation', () => {
  it('rejects a request body over the data size limit (413)', async () => {
    const user = randomUUID();
    // Over BODY_LIMIT.data (512 KiB) — rejected by middleware before the handler.
    const res = await authed(user, '/data/settings/bag', 'PUT', {
      value: 'x'.repeat(600 * 1024),
    });
    expect(res.status).toBe(413);
  });

  it('caps a long-form text field (settings value, 10k ceiling)', async () => {
    const user = randomUUID();
    const res = await authed(user, '/data/settings/bag', 'PUT', {
      value: 'x'.repeat(10_001),
    });
    expect(res.status).toBe(400);
  });

  it('caps a short text field (round course_name, 1k ceiling)', async () => {
    const user = randomUUID();
    const roundId = randomUUID();
    const res = await authed(user, `/data/rounds/${roundId}`, 'PUT', {
      course_name: 'x'.repeat(1_001),
      hole_count: 9,
      holes: holeRows(roundId, 9),
    });
    expect(res.status).toBe(400);
  });
});
