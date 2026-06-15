import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// Capture/steer Expo push sends without touching the network. Hoisted so the
// vi.mock factory (also hoisted) can close over the same object the tests read.
const pushMock = vi.hoisted(() => ({ sent: [] as { to: string }[], fail: false }));

vi.mock('expo-server-sdk', () => {
  class Expo {
    static isExpoPushToken(t: unknown): boolean {
      return typeof t === 'string' && t.startsWith('ExponentPushToken');
    }
    chunkPushNotifications<T>(messages: T[]): T[][] {
      return [messages];
    }
    async sendPushNotificationsAsync(chunk: { to: string }[]) {
      if (pushMock.fail) throw new Error('expo unavailable');
      pushMock.sent.push(...chunk);
      return chunk.map(() => ({ status: 'ok' as const }));
    }
  }
  return { Expo };
});

import { pool } from '../src/db/client';
import { runMigrations } from '../src/migrate';
import { dispatchRoundShareNotifications } from '../src/notifications/dispatch';

beforeAll(async () => {
  await runMigrations();
});

afterAll(async () => {
  await pool.end();
});

beforeEach(() => {
  pushMock.sent = [];
  pushMock.fail = false;
});

async function makeUser(): Promise<string> {
  const handle = `notif_${randomUUID().slice(0, 8)}`;
  const res = await pool.query<{ id: string }>(
    `INSERT INTO users (username, email) VALUES ($1, $2) RETURNING id`,
    [handle, `${handle}@t`],
  );
  return res.rows[0]!.id;
}

async function befriend(a: string, b: string): Promise<void> {
  const [low, high] = a < b ? [a, b] : [b, a];
  await pool.query(
    `INSERT INTO friendships (user_low, user_high) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [low, high],
  );
}

async function addToken(userId: string): Promise<string> {
  const token = `ExponentPushToken[${randomUUID()}]`;
  await pool.query(`INSERT INTO push_tokens (token, user_id) VALUES ($1, $2)`, [token, userId]);
  return token;
}

async function block(blocker: string, blocked: string): Promise<void> {
  await pool.query(
    `INSERT INTO user_blocks (blocker_id, blocked_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [blocker, blocked],
  );
}

// A completed, shareable round finished "now" so it falls inside the recency window.
async function seedCompletedRound(ownerId: string): Promise<string> {
  const id = randomUUID();
  const completedAt = new Date().toISOString();
  await pool.query(
    `INSERT INTO rounds (id, user_id, course_name, date_played, hole_count, completed_at,
        include_in_handicap, exclude_from_sharing, created_at, updated_at)
     VALUES ($1, $2, 'Test Links', '2026-06-14', 18, $3, 1, 0, $3, $3)`,
    [id, ownerId, completedAt],
  );
  return id;
}

async function ledgerCount(ownerId: string, roundId: string): Promise<number> {
  const res = await pool.query(
    `SELECT 1 FROM round_share_notifications WHERE round_owner_id = $1 AND round_id = $2`,
    [ownerId, roundId],
  );
  return res.rowCount ?? 0;
}

describe('dispatchRoundShareNotifications', () => {
  it('notifies a friend with a registered token and records the claim', async () => {
    const owner = await makeUser();
    const friend = await makeUser();
    await befriend(owner, friend);
    const token = await addToken(friend);
    const roundId = await seedCompletedRound(owner);

    await dispatchRoundShareNotifications(owner);

    expect(pushMock.sent.map((m) => m.to)).toContain(token);
    expect(await ledgerCount(owner, roundId)).toBe(1);
  });

  it('does NOT keep a claim when no friend has a token (so it can fire later)', async () => {
    const owner = await makeUser();
    const friend = await makeUser(); // friend exists but never registered a token
    await befriend(owner, friend);
    const roundId = await seedCompletedRound(owner);

    await dispatchRoundShareNotifications(owner);

    expect(pushMock.sent).toHaveLength(0);
    expect(await ledgerCount(owner, roundId)).toBe(0);

    // Later: friend registers a token → a subsequent dispatch now delivers.
    const token = await addToken(friend);
    await dispatchRoundShareNotifications(owner);
    expect(pushMock.sent.map((m) => m.to)).toContain(token);
    expect(await ledgerCount(owner, roundId)).toBe(1);
  });

  it('excludes a blocked friend from recipients', async () => {
    const owner = await makeUser();
    const friend = await makeUser();
    await befriend(owner, friend);
    const token = await addToken(friend);
    await block(friend, owner); // friend blocked the owner
    const roundId = await seedCompletedRound(owner);

    await dispatchRoundShareNotifications(owner);

    expect(pushMock.sent.map((m) => m.to)).not.toContain(token);
    // No deliverable recipient → claim released so it isn't permanently suppressed.
    expect(await ledgerCount(owner, roundId)).toBe(0);
  });

  it('releases the claim on a transient send failure so it can retry', async () => {
    const owner = await makeUser();
    const friend = await makeUser();
    await befriend(owner, friend);
    await addToken(friend);
    const roundId = await seedCompletedRound(owner);

    pushMock.fail = true;
    await dispatchRoundShareNotifications(owner);
    expect(await ledgerCount(owner, roundId)).toBe(0);

    // Expo recovers → retry delivers and records the claim.
    pushMock.fail = false;
    await dispatchRoundShareNotifications(owner);
    expect(pushMock.sent).toHaveLength(1);
    expect(await ledgerCount(owner, roundId)).toBe(1);
  });
});
